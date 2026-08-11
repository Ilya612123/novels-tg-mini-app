import type { UserAccess } from "@prisma/client";
import type { DbClient } from "../db.js";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function getActiveAccess(db: DbClient, userId: string, now = new Date()): Promise<UserAccess | null> {
  const access = await db.userAccess.findUnique({ where: { userId } });
  if (!access) return null;
  return access.subscriptionUntil.getTime() > now.getTime() ? access : null;
}

export async function extendAccessByThirtyDays(db: DbClient, userId: string, now = new Date()): Promise<UserAccess> {
  const current = await db.userAccess.findUnique({ where: { userId } });
  const base = current && current.subscriptionUntil.getTime() > now.getTime() ? current.subscriptionUntil : now;
  const subscriptionUntil = new Date(base.getTime() + THIRTY_DAYS_MS);

  return db.userAccess.upsert({
    where: { userId },
    create: { userId, subscriptionUntil },
    update: { subscriptionUntil }
  });
}
