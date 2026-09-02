import type { DbClient } from "../db.js";
import { listUnattributedBotStartEvents } from "../repositories/botStarts.js";
import {
  createUserAttribution,
  listActionDeltasOverlappingWindow,
  type UserAttributionStatus
} from "../repositories/userAttributions.js";

export type AdsAttributionMatchOptions = {
  now?: Date;
  beforeWindowSeconds: number;
  afterWindowSeconds: number;
  unknownAfterSeconds: number;
  limit: number;
};

export type AdsAttributionMatchSummary = {
  processed: number;
  likely: number;
  ambiguous: number;
  unknown: number;
};

function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}

export async function matchPendingTelegramAdsAttributions(
  db: DbClient,
  options: AdsAttributionMatchOptions
): Promise<AdsAttributionMatchSummary> {
  const now = options.now ?? new Date();
  const starts = await listUnattributedBotStartEvents(db, now, options.limit);
  const summary: AdsAttributionMatchSummary = { processed: 0, likely: 0, ambiguous: 0, unknown: 0 };

  for (const start of starts) {
    if (now.getTime() - start.occurredAt.getTime() < options.unknownAfterSeconds * 1000) continue;

    const matchedWindowFrom = addSeconds(start.occurredAt, -options.beforeWindowSeconds);
    const matchedWindowTo = addSeconds(start.occurredAt, options.afterWindowSeconds);
    const deltas = await listActionDeltasOverlappingWindow(db, matchedWindowFrom, matchedWindowTo);
    const candidates = deltas.map((delta) => ({
      adKey: delta.adKey,
      adTitle: delta.adTitle,
      delta: delta.delta
    }));

    let status: UserAttributionStatus = "unknown";
    let primarySource: string | null = null;
    if (candidates.length === 1) {
      status = "likely";
      primarySource = candidates[0].adTitle;
    } else if (candidates.length > 1) {
      status = "ambiguous";
    }

    await createUserAttribution(db, {
      userId: start.userId,
      botStartEventId: start.id,
      status,
      primarySource,
      candidates,
      matchedWindowFrom,
      matchedWindowTo
    });
    summary.processed += 1;
    summary[status] += 1;
  }

  return summary;
}
