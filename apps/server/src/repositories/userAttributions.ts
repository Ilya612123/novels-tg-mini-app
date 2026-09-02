import type { TelegramAdActionDelta, UserAttribution } from "@prisma/client";
import type { DbClient } from "../db.js";

export type UserAttributionStatus = "likely" | "ambiguous" | "unknown";

export async function createUserAttribution(
  db: DbClient,
  input: {
    userId: string;
    botStartEventId: string;
    status: UserAttributionStatus;
    primarySource?: string | null;
    candidates?: unknown[];
    matchedWindowFrom: Date;
    matchedWindowTo: Date;
  }
): Promise<UserAttribution> {
  try {
    return await db.userAttribution.create({
      data: {
        userId: input.userId,
        botStartEventId: input.botStartEventId,
        status: input.status,
        primarySource: input.primarySource ?? null,
        candidatesJson: JSON.stringify(input.candidates ?? []),
        matchedWindowFrom: input.matchedWindowFrom,
        matchedWindowTo: input.matchedWindowTo
      }
    });
  } catch (error) {
    const existing = await findAttributionForStartEvent(db, input.botStartEventId);
    if (existing) return existing;
    throw error;
  }
}

export async function findAttributionForStartEvent(
  db: DbClient,
  botStartEventId: string
): Promise<UserAttribution | null> {
  return db.userAttribution.findUnique({ where: { botStartEventId } });
}

export async function listActionDeltasOverlappingWindow(
  db: DbClient,
  from: Date,
  to: Date
): Promise<TelegramAdActionDelta[]> {
  return db.telegramAdActionDelta.findMany({
    where: {
      observedFrom: { lte: to },
      observedTo: { gte: from }
    },
    orderBy: [{ observedFrom: "asc" }, { adKey: "asc" }]
  });
}
