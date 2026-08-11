import type { AnalyticsEvent } from "@prisma/client";
import type { DbClient } from "../db.js";

export type AnalyticsSource = "bot" | "miniapp";

export async function recordAnalyticsEvent(
  db: DbClient,
  input: {
    userId: string;
    username?: string | null;
    source: AnalyticsSource;
    label: string;
    metadata?: unknown;
    occurredAt?: Date;
  }
): Promise<AnalyticsEvent> {
  return db.analyticsEvent.create({
    data: {
      userId: input.userId,
      username: input.username ?? null,
      source: input.source,
      label: input.label,
      metadata: input.metadata == null ? null : JSON.stringify(input.metadata),
      occurredAt: input.occurredAt ?? new Date()
    }
  });
}

export async function listUnflushedAnalyticsEvents(db: DbClient, before: Date): Promise<AnalyticsEvent[]> {
  return db.analyticsEvent.findMany({
    where: {
      flushedAt: null,
      occurredAt: { lt: before }
    },
    orderBy: { occurredAt: "asc" }
  });
}

export async function markAnalyticsEventsFlushed(db: DbClient, ids: string[], flushedAt = new Date()): Promise<number> {
  if (ids.length === 0) return 0;
  const result = await db.analyticsEvent.updateMany({
    where: { id: { in: ids } },
    data: { flushedAt }
  });
  return result.count;
}
