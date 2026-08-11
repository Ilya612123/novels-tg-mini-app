import type { TelegramUser } from "@prisma/client";
import type { DbClient } from "../db.js";

export async function upsertTelegramUser(
  db: DbClient,
  input: {
    id: string;
    username?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  }
): Promise<TelegramUser> {
  return db.telegramUser.upsert({
    where: { id: input.id },
    create: {
      id: input.id,
      username: input.username ?? null,
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null
    },
    update: {
      username: input.username ?? null,
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null
    }
  });
}
