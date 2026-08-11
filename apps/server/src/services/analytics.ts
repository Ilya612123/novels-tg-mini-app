import type { AnalyticsEvent } from "@prisma/client";
import type { DbClient } from "../db.js";
import { recordAnalyticsEvent } from "../repositories/analytics.js";

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
