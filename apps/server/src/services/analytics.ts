import type { AnalyticsEvent } from "@prisma/client";
import type { Bot } from "grammy";
import { formatAnalyticsBatch, type AnalyticsEventForFormat } from "@novell-reader/shared";
import type { DbClient } from "../db.js";
import { listUnflushedAnalyticsEvents, markAnalyticsEventsFlushed, recordAnalyticsEvent } from "../repositories/analytics.js";
import { findAttributionForStartEvent } from "../repositories/userAttributions.js";

const ANALYTICS_EVENTS_PER_MESSAGE = 50;

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

function splitAnalyticsEvents(events: AnalyticsEvent[], now: Date): AnalyticsEvent[][] {
  const batches: AnalyticsEvent[][] = [];
  for (let index = 0; index < events.length; index += ANALYTICS_EVENTS_PER_MESSAGE) {
    batches.push(events.slice(index, index + ANALYTICS_EVENTS_PER_MESSAGE));
  }
  return batches;
}

export async function flushAnalyticsToTelegram(input: {
  db: DbClient;
  bot: Bot;
  chatId: string;
  now?: Date;
}): Promise<{ sent: boolean; eventCount: number }> {
  const now = input.now ?? new Date();
  const events = await listUnflushedAnalyticsEvents(input.db, now);
  if (events.length === 0) return { sent: false, eventCount: 0 };

  let sentCount = 0;
  for (const batch of splitAnalyticsEvents(events, now)) {
    const text = await formatAnalyticsEvents(input.db, batch, now);
    if (!text) continue;

    await input.bot.api.sendMessage(input.chatId, text);
    await markAnalyticsEventsFlushed(
      input.db,
      batch.map((event) => event.id),
      now
    );
    sentCount += batch.length;
  }

  return { sent: sentCount > 0, eventCount: sentCount };
}
