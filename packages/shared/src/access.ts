export type AccessCheckInput = {
  chapterNumber: number;
  totalChapters: number;
  manualFreeChapterLimit?: number | null;
  subscriptionUntil: Date | string | null;
  now?: Date;
};

const DEFAULT_FREE_CHAPTER_LIMIT = 4;

export function calculateFreeChapterLimit(totalChapters: number, manualLimit?: number | null): number {
  const maxFreeChapters = Math.min(DEFAULT_FREE_CHAPTER_LIMIT, Math.max(1, totalChapters));

  if (manualLimit != null && manualLimit > 0) {
    return Math.min(manualLimit, maxFreeChapters);
  }

  return maxFreeChapters;
}

export function canReadChapter(input: AccessCheckInput): boolean {
  const freeLimit = calculateFreeChapterLimit(input.totalChapters, input.manualFreeChapterLimit);
  if (input.chapterNumber <= freeLimit) return true;
  if (!input.subscriptionUntil) return false;

  const now = input.now ?? new Date();
  const until = input.subscriptionUntil instanceof Date ? input.subscriptionUntil : new Date(input.subscriptionUntil);
  return until.getTime() > now.getTime();
}
