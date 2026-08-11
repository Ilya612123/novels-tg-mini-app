import type { Request } from "express";
import { HttpError } from "./httpErrors.js";
import type { DbClient } from "./db.js";
import { upsertTelegramUser } from "./repositories/users.js";

export type RequestUser = {
  id: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
};

export async function requireTelegramUser(db: DbClient, req: Request): Promise<RequestUser> {
  if (process.env.NODE_ENV !== "production") {
    const id = req.header("x-dev-telegram-user-id");
    if (id) {
      const user = {
        id,
        username: req.header("x-dev-telegram-username") ?? null,
        firstName: req.header("x-dev-telegram-first-name") ?? null,
        lastName: req.header("x-dev-telegram-last-name") ?? null
      };
      await upsertTelegramUser(db, user);
      return user;
    }
  }

  const initData = req.header("x-telegram-init-data");
  if (!initData) {
    throw new HttpError(401, "Не удалось определить пользователя Telegram");
  }

  throw new HttpError(401, "Проверка Telegram init data будет подключена перед production-запуском");
}
