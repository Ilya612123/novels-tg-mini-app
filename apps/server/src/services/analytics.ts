import type { AnalyticsEvent } from "@prisma/client";
import type { Bot } from "grammy";
import { formatAnalyticsBatch, type AnalyticsEventForFormat } from "@novell-reader/shared";
import type { DbClient } from "../db.js";
import { listUnflushedAnalyticsEvents, markAnalyticsEventsFlushed, recordAnalyticsEvent } from "../repositories/analytics.js";

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

function toFormattedAnalyticsEvent(event: AnalyticsEvent): AnalyticsEventForFormat {
  return {
    userId: event.userId,
    username: event.username,
    occurredAt: event.occurredAt,
    label: event.label,
    source: event.source === "bot" ? "bot" : ("miniapp" as const)
  };
}

function formatAnalyticsEvents(events: AnalyticsEvent[], now: Date): string | null {
  return formatAnalyticsBatch({
    from: events[0]!.occurredAt,
    to: now,
    events: events.map(toFormattedAnalyticsEvent)
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
    const text = formatAnalyticsEvents(batch, now);
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
