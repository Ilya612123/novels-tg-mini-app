import type { UserAccess } from "@prisma/client";
import { canReadChapter } from "@novell-reader/shared";

export type ReadableChapterStateInput = {
  chapterNumber: number;
  totalChapters: number;
  freeChapterLimit: number;
  subscriptionUntil: Date | string | null;
  now?: Date;
};

export type ReadableChapterState = { canRead: true } | { canRead: false; reason: "paywall" };

export function getReadableChapterState(input: ReadableChapterStateInput): ReadableChapterState {
  const allowed = canReadChapter({
    chapterNumber: input.chapterNumber,
    totalChapters: input.totalChapters,
    manualFreeChapterLimit: input.freeChapterLimit,
    subscriptionUntil: input.subscriptionUntil,
    now: input.now
  });

  return allowed ? { canRead: true } : { canRead: false, reason: "paywall" };
}

export function toAccessStatus(access: UserAccess | null, now = new Date()) {
  if (!access || access.subscriptionUntil.getTime() <= now.getTime()) {
    return { active: false, subscriptionUntil: null };
  }

  return { active: true, subscriptionUntil: access.subscriptionUntil.toISOString() };
}
