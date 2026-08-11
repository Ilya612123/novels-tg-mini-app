export type AccessCheckInput = {
  chapterNumber: number;
  totalChapters: number;
  manualFreeChapterLimit?: number | null;
  subscriptionUntil: Date | string | null;
  now?: Date;
};

export function calculateFreeChapterLimit(totalChapters: number, manualLimit?: number | null): number {
  if (manualLimit != null && manualLimit > 0) {
    return Math.min(manualLimit, Math.max(1, totalChapters));
  }

  return Math.max(1, Math.ceil(totalChapters / 3));
}

export function canReadChapter(input: AccessCheckInput): boolean {
  const freeLimit = calculateFreeChapterLimit(input.totalChapters, input.manualFreeChapterLimit);
  if (input.chapterNumber <= freeLimit) return true;
  if (!input.subscriptionUntil) return false;

  const now = input.now ?? new Date();
  const until = input.subscriptionUntil instanceof Date ? input.subscriptionUntil : new Date(input.subscriptionUntil);
  return until.getTime() > now.getTime();
}
