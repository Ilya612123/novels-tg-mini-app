import crypto from "node:crypto";
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

export function validateTelegramInitData(initData: string, botToken: string): RequestUser | null {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  const userRaw = params.get("user");
  if (!hash || !userRaw) return null;

  params.delete("hash");
  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const calculatedHash = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");
  if (!/^[a-f0-9]{64}$/i.test(hash)) return null;
  const valid = crypto.timingSafeEqual(Buffer.from(calculatedHash, "hex"), Buffer.from(hash, "hex"));
  if (!valid) return null;

  let user: {
    id: number;
    username?: string;
    first_name?: string;
    last_name?: string;
  };

  try {
    user = JSON.parse(userRaw) as typeof user;
  } catch {
    return null;
  }

  return {
    id: String(user.id),
    username: user.username ?? null,
    firstName: user.first_name ?? null,
    lastName: user.last_name ?? null
  };
}

export async function requireTelegramUser(db: DbClient, req: Request, botToken = process.env.BOT_TOKEN ?? ""): Promise<RequestUser> {
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

  const user = validateTelegramInitData(initData, botToken);
  if (!user) {
    throw new HttpError(401, "Некорректная подпись Telegram Mini App");
  }

  await upsertTelegramUser(db, user);
  return user;
}
