import type { AnalyticsEvent } from "@prisma/client";
import type { Bot } from "grammy";
import { formatAnalyticsBatch } from "@novell-reader/shared";
import type { DbClient } from "../db.js";
import { listUnflushedAnalyticsEvents, markAnalyticsEventsFlushed, recordAnalyticsEvent } from "../repositories/analytics.js";

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

export async function flushAnalyticsToTelegram(input: {
  db: DbClient;
  bot: Bot;
  channelId: string;
  now?: Date;
}): Promise<{ sent: boolean; eventCount: number }> {
  const now = input.now ?? new Date();
  const events = await listUnflushedAnalyticsEvents(input.db, now);
  if (events.length === 0) return { sent: false, eventCount: 0 };

  const text = formatAnalyticsBatch({
    from: events[0]!.occurredAt,
    to: now,
    events: events.map((event) => ({
      userId: event.userId,
      username: event.username,
      occurredAt: event.occurredAt,
      label: event.label,
      source: event.source === "bot" ? "bot" : "miniapp"
    }))
  });

  if (!text) return { sent: false, eventCount: 0 };

  await input.bot.api.sendMessage(input.channelId, text);
  await markAnalyticsEventsFlushed(
    input.db,
    events.map((event) => event.id),
    now
  );

  return { sent: true, eventCount: events.length };
}
