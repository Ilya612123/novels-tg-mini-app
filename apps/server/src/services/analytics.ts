import type { AnalyticsEvent } from "@prisma/client";
import type { Bot } from "grammy";
import { formatAnalyticsBatch, type AnalyticsEventForFormat } from "@novell-reader/shared";
import type { DbClient } from "../db.js";
import { listUnflushedAnalyticsEvents, markAnalyticsEventsFlushed, recordAnalyticsEvent } from "../repositories/analytics.js";
import { findAttributionForStartEvent } from "../repositories/userAttributions.js";

const ANALYTICS_EVENTS_PER_MESSAGE = 50;
const TELEGRAM_MESSAGE_LIMIT = 4096;
const TRUNCATED_MESSAGE_SUFFIX = "\n...[truncated]";

export type AnalyticsInput = {
  userId: string;
  username?: string | null;
  source: "bot" | "miniapp";
  label: string;
  metadata?: unknown;
};

export async function createAnalyticsEvent(db: DbClient, input: AnalyticsInput): Promise<AnalyticsEvent> {
  return recordAnalyticsEvent(db, input);
}

function parseAnalyticsMetadata(metadata: string | null): unknown {
  if (!metadata) return undefined;

  try {
    return JSON.parse(metadata);
  } catch {
    return undefined;
  }
}

function metadataObject(metadata: unknown): Record<string, unknown> | null {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata) ? (metadata as Record<string, unknown>) : null;
}

function formatAttributionLine(attribution: {
  status: string;
  primarySource: string | null;
  candidatesJson: string | null;
}): string {
  if (attribution.status === "likely" && attribution.primarySource) {
    return `атрибуция: likely, ${attribution.primarySource}`;
  }
  if (attribution.status === "ambiguous") {
    let candidates: Array<{ adTitle?: string }> = [];
    try {
      candidates = JSON.parse(attribution.candidatesJson ?? "[]") as Array<{ adTitle?: string }>;
    } catch {
      candidates = [];
    }
    const titles = candidates.map((candidate) => candidate.adTitle).filter((title): title is string => Boolean(title));
    return `атрибуция: ambiguous, варианты: ${titles.join(", ")}`;
  }
  return "атрибуция: unknown";
}

async function toFormattedAnalyticsEvent(db: DbClient, event: AnalyticsEvent): Promise<AnalyticsEventForFormat> {
  const metadata = parseAnalyticsMetadata(event.metadata);
  const objectMetadata = metadataObject(metadata);
  let label = event.label;
  let formattedMetadata = metadata;

  if (event.source === "bot" && event.label === "старт бота" && typeof objectMetadata?.botStartEventId === "string") {
    const attribution = await findAttributionForStartEvent(db, objectMetadata.botStartEventId);
    const { botStartEventId: _botStartEventId, ...publicMetadata } = objectMetadata;
    formattedMetadata = Object.keys(publicMetadata).length > 0 ? publicMetadata : undefined;
    if (attribution) label = `${label}\n    ${formatAttributionLine(attribution)}`;
  }

  return {
    userId: event.userId,
    username: event.username,
    occurredAt: event.occurredAt,
    label,
    metadata: formattedMetadata,
    source: event.source === "bot" ? "bot" : ("miniapp" as const)
  };
}

async function formatAnalyticsEvents(db: DbClient, events: AnalyticsEvent[], now: Date): Promise<string | null> {
  return formatAnalyticsBatch({
    from: events[0]!.occurredAt,
    to: now,
    events: await Promise.all(events.map((event) => toFormattedAnalyticsEvent(db, event)))
  });
}

function fitTelegramMessage(text: string): string {
  if (text.length <= TELEGRAM_MESSAGE_LIMIT) return text;
  return `${text.slice(0, TELEGRAM_MESSAGE_LIMIT - TRUNCATED_MESSAGE_SUFFIX.length)}${TRUNCATED_MESSAGE_SUFFIX}`;
}

async function splitAnalyticsEvents(db: DbClient, events: AnalyticsEvent[], now: Date): Promise<AnalyticsEvent[][]> {
  const batches: AnalyticsEvent[][] = [];
  let currentBatch: AnalyticsEvent[] = [];

  for (const event of events) {
    const nextBatch = [...currentBatch, event];
    const nextText = await formatAnalyticsEvents(db, nextBatch, now);
    if (
      currentBatch.length > 0 &&
      (nextBatch.length > ANALYTICS_EVENTS_PER_MESSAGE || (nextText?.length ?? 0) > TELEGRAM_MESSAGE_LIMIT)
    ) {
      batches.push(currentBatch);
      currentBatch = [event];
    } else {
      currentBatch = nextBatch;
    }
  }

  if (currentBatch.length > 0) batches.push(currentBatch);
  return batches;
}

function isDelayedBotStartEvent(event: AnalyticsEvent, now: Date, delaySeconds: number): boolean {
  if (delaySeconds <= 0) return false;
  return event.source === "bot" && event.label === "старт бота" && now.getTime() - event.occurredAt.getTime() < delaySeconds * 1000;
}

export async function flushAnalyticsToTelegram(input: {
  db: DbClient;
  bot: Bot;
  chatId: string;
  now?: Date;
  botStartDelaySeconds?: number;
}): Promise<{ sent: boolean; eventCount: number }> {
  const now = input.now ?? new Date();
  const allEvents = await listUnflushedAnalyticsEvents(input.db, now);
  const events = allEvents.filter((event) => !isDelayedBotStartEvent(event, now, input.botStartDelaySeconds ?? 0));
  if (events.length === 0) return { sent: false, eventCount: 0 };

  let sentCount = 0;
  for (const batch of await splitAnalyticsEvents(input.db, events, now)) {
    const text = await formatAnalyticsEvents(input.db, batch, now);
    if (!text) continue;

    await input.bot.api.sendMessage(input.chatId, fitTelegramMessage(text));
    await markAnalyticsEventsFlushed(
      input.db,
      batch.map((event) => event.id),
      now
    );
    sentCount += batch.length;
  }

  return { sent: sentCount > 0, eventCount: sentCount };
}
