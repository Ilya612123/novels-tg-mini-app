import type { BotStartEvent } from "@prisma/client";
import type { DbClient } from "../db.js";

export async function recordBotStartEvent(
  db: DbClient,
  input: {
    userId: string;
    username?: string | null;
    occurredAt?: Date;
  }
): Promise<BotStartEvent> {
  const existingCount = await db.botStartEvent.count({ where: { userId: input.userId } });
  return db.botStartEvent.create({
    data: {
      userId: input.userId,
      username: input.username ?? null,
      occurredAt: input.occurredAt ?? new Date(),
      isFirstStart: existingCount === 0
    }
  });
}

export async function listUnattributedBotStartEvents(
  db: DbClient,
  before: Date,
  limit: number
): Promise<BotStartEvent[]> {
  return db.botStartEvent.findMany({
    where: {
      occurredAt: { lt: before },
      attribution: null
    },
    orderBy: { occurredAt: "asc" },
    take: limit
  });
}
