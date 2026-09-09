import { InlineKeyboard, type Bot } from "grammy";
import type { AnalyticsEvent, Book, ReadingProgress, TelegramUser } from "@prisma/client";
import type { DbClient } from "../db.js";
import { recordAnalyticsEvent } from "../repositories/analytics.js";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export type PushScenario = "opened_app_no_read" | "chapter1_to_chapter2" | "inactive_reader" | "near_paywall";

type ProgressWithUserAndBook = ReadingProgress & {
  user: TelegramUser;
  book: Book;
};

type AnalyticsEventWithUser = AnalyticsEvent & {
  user: TelegramUser;
};

type PushCandidate = {
  scenario: PushScenario;
  templateId: string;
  messageText: string;
  userId: string;
  username: string | null;
  bookId: string | null;
  bookTitle: string | null;
  chapterNumber: number | null;
  targetChapterNumber: number | null;
  progressUpdatedAt: Date;
  scheduledAt: Date;
};

export type PushNotificationOptions = {
  enabled: boolean;
  intervalMs: number;
  minHoursBetweenMessages: number;
  maxPerDay: number;
  maxPerWeek: number;
  chapter1DelayHours: number;
  openedAppNoReadDelayHours: number;
  inactiveReaderDelayHours: number;
  nearPaywallDelayHours: number;
  duplicateWindowHours: number;
  limit: number;
};

export const defaultPushNotificationOptions: PushNotificationOptions = {
  enabled: process.env.NODE_ENV === "production",
  intervalMs: 60_000,
  minHoursBetweenMessages: 6,
  maxPerDay: 2,
  maxPerWeek: 5,
  chapter1DelayHours: 2,
  openedAppNoReadDelayHours: 1,
  inactiveReaderDelayHours: 22,
  nearPaywallDelayHours: 2,
  duplicateWindowHours: 7 * 24,
  limit: 100
};

function hoursAgo(now: Date, hours: number): Date {
  return new Date(now.getTime() - hours * HOUR_MS);
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * HOUR_MS);
}

function buildReaderUrl(miniAppUrl: string, candidate: PushCandidate): string {
  const url = new URL(miniAppUrl);
  if (candidate.bookId && candidate.chapterNumber) {
    url.searchParams.set("bookId", candidate.bookId);
    url.searchParams.set("chapter", String(candidate.chapterNumber));
  }
  url.searchParams.set("push", candidate.templateId);
  url.searchParams.set("scenario", candidate.scenario);
  return url.toString();
}

function analyticsMetadata(candidate: PushCandidate, extra: Record<string, unknown> = {}) {
  return {
    userId: candidate.userId,
    username: candidate.username,
    scenario: candidate.scenario,
    templateId: candidate.templateId,
    messageText: candidate.messageText,
    bookId: candidate.bookId,
    bookTitle: candidate.bookTitle,
    chapterNumber: candidate.chapterNumber,
    targetChapterNumber: candidate.targetChapterNumber,
    scheduledAt: candidate.scheduledAt.toISOString(),
    progressUpdatedAt: candidate.progressUpdatedAt.toISOString(),
    ...extra
  };
}

async function recordPushAnalytics(
  db: DbClient,
  label: string,
  candidate: PushCandidate,
  extra: Record<string, unknown> = {},
  occurredAt = new Date()
) {
  await recordAnalyticsEvent(db, {
    userId: candidate.userId,
    username: candidate.username,
    source: "bot",
    label,
    metadata: analyticsMetadata(candidate, extra),
    occurredAt
  });
}

function candidateKeyWhere(candidate: PushCandidate, labels: string[], since: Date) {
  const metadataConditions = [{ metadata: { contains: `"scenario":"${candidate.scenario}"` } }];
  metadataConditions.push({ metadata: { contains: `"templateId":"${candidate.templateId}"` } });
  if (candidate.bookId) {
    metadataConditions.push({ metadata: { contains: `"bookId":"${candidate.bookId}"` } });
  }
  if (candidate.chapterNumber) {
    metadataConditions.push({ metadata: { contains: `"chapterNumber":${candidate.chapterNumber}` } });
  }

  return {
    userId: candidate.userId,
    label: { in: labels },
    occurredAt: { gte: since },
    AND: metadataConditions
  };
}

async function hasRecentDecision(db: DbClient, candidate: PushCandidate): Promise<boolean> {
  const existing = await db.analyticsEvent.findFirst({
    where: candidateKeyWhere(
      candidate,
      [
        "push_scheduled",
        "push_sent",
        "push_failed",
        "push_suppressed_frequency_cap",
        "push_suppressed_paid",
        "push_suppressed_target_completed",
        "push_suppressed_duplicate"
      ],
      candidate.progressUpdatedAt
    ),
    select: { id: true }
  });
  return Boolean(existing);
}

async function hasRecentDuplicateSent(db: DbClient, candidate: PushCandidate, now: Date, options: PushNotificationOptions) {
  const existing = await db.analyticsEvent.findFirst({
    where: candidateKeyWhere(candidate, ["push_sent"], hoursAgo(now, options.duplicateWindowHours)),
    select: { id: true }
  });
  return Boolean(existing);
}

async function getFrequencyCapReason(
  db: DbClient,
  userId: string,
  now: Date,
  options: PushNotificationOptions
): Promise<string | null> {
  const [lastSixHours, lastDay, lastWeek] = await Promise.all([
    db.analyticsEvent.count({
      where: { userId, label: "push_sent", occurredAt: { gte: hoursAgo(now, options.minHoursBetweenMessages) } }
    }),
    db.analyticsEvent.count({
      where: { userId, label: "push_sent", occurredAt: { gte: new Date(now.getTime() - DAY_MS) } }
    }),
    db.analyticsEvent.count({
      where: { userId, label: "push_sent", occurredAt: { gte: new Date(now.getTime() - 7 * DAY_MS) } }
    })
  ]);

  if (lastSixHours > 0) return "min_hours_between_messages";
  if (lastDay >= options.maxPerDay) return "max_per_day";
  if (lastWeek >= options.maxPerWeek) return "max_per_week";
  return null;
}

async function hasActiveAccess(db: DbClient, userId: string, now: Date): Promise<boolean> {
  const access = await db.userAccess.findUnique({ where: { userId } });
  return Boolean(access && access.subscriptionUntil.getTime() > now.getTime());
}

async function hasTargetCompleted(db: DbClient, candidate: PushCandidate): Promise<boolean> {
  if (candidate.scenario === "opened_app_no_read") {
    const progress = await db.readingProgress.findFirst({
      where: { userId: candidate.userId },
      select: { id: true }
    });
    return Boolean(progress);
  }

  if (!candidate.bookId || !candidate.targetChapterNumber) return true;
  const progress = await db.readingProgress.findUnique({
    where: {
      userId_bookId: {
        userId: candidate.userId,
        bookId: candidate.bookId
      }
    },
    select: { chapterNumber: true, updatedAt: true }
  });
  if (!progress) return true;
  if (progress.updatedAt.getTime() > candidate.progressUpdatedAt.getTime() && progress.chapterNumber >= candidate.targetChapterNumber) {
    return true;
  }
  return progress.chapterNumber >= candidate.targetChapterNumber;
}

function toOpenedAppNoReadCandidate(event: AnalyticsEventWithUser, now: Date, options: PushNotificationOptions): PushCandidate | null {
  const scheduledAt = addHours(event.occurredAt, options.openedAppNoReadDelayHours);
  if (scheduledAt.getTime() > now.getTime()) return null;
  return {
    scenario: "opened_app_no_read",
    templateId: "opened_app_no_read_v1",
    messageText: "Подобрали несколько историй на вечер. Начать с первой главы?",
    userId: event.userId,
    username: event.user.username,
    bookId: null,
    bookTitle: null,
    chapterNumber: null,
    targetChapterNumber: null,
    progressUpdatedAt: event.occurredAt,
    scheduledAt
  };
}

function toChapter1Candidate(progress: ProgressWithUserAndBook, now: Date, options: PushNotificationOptions): PushCandidate | null {
  if (progress.chapterNumber !== 1) return null;
  const scheduledAt = addHours(progress.updatedAt, options.chapter1DelayHours);
  if (scheduledAt.getTime() > now.getTime()) return null;
  return {
    scenario: "chapter1_to_chapter2",
    templateId: "chapter1_to_chapter2_v1",
    messageText: "Первая глава только завязка. Продолжить со второй?",
    userId: progress.userId,
    username: progress.user.username,
    bookId: progress.bookId,
    bookTitle: progress.book.title,
    chapterNumber: 2,
    targetChapterNumber: 2,
    progressUpdatedAt: progress.updatedAt,
    scheduledAt
  };
}

function toInactiveReaderCandidate(progress: ProgressWithUserAndBook, now: Date, options: PushNotificationOptions): PushCandidate | null {
  if (progress.chapterNumber < 2) return null;
  const scheduledAt = addHours(progress.updatedAt, options.inactiveReaderDelayHours);
  if (scheduledAt.getTime() > now.getTime()) return null;
  return {
    scenario: "inactive_reader",
    templateId: "inactive_reader_v1",
    messageText: `Ты остановилась на главе ${progress.chapterNumber}. Продолжить с того же места?`,
    userId: progress.userId,
    username: progress.user.username,
    bookId: progress.bookId,
    bookTitle: progress.book.title,
    chapterNumber: progress.chapterNumber,
    targetChapterNumber: progress.chapterNumber + 1,
    progressUpdatedAt: progress.updatedAt,
    scheduledAt
  };
}

function toNearPaywallCandidate(progress: ProgressWithUserAndBook, now: Date, options: PushNotificationOptions): PushCandidate | null {
  const nearPaywallChapters = [progress.book.freeChapterLimit - 1, progress.book.freeChapterLimit - 2].filter((chapter) => chapter > 0);
  if (!nearPaywallChapters.includes(progress.chapterNumber)) return null;
  const scheduledAt = addHours(progress.updatedAt, options.nearPaywallDelayHours);
  if (scheduledAt.getTime() > now.getTime()) return null;
  return {
    scenario: "near_paywall",
    templateId: "near_paywall_v1",
    messageText: "Ты почти дошла до разворота сюжета. Продолжить?",
    userId: progress.userId,
    username: progress.user.username,
    bookId: progress.bookId,
    bookTitle: progress.book.title,
    chapterNumber: progress.chapterNumber,
    targetChapterNumber: progress.chapterNumber + 1,
    progressUpdatedAt: progress.updatedAt,
    scheduledAt
  };
}

function buildCandidates(progressItems: ProgressWithUserAndBook[], now: Date, options: PushNotificationOptions): PushCandidate[] {
  return progressItems
    .flatMap((progress) =>
      [
        toNearPaywallCandidate(progress, now, options),
        toChapter1Candidate(progress, now, options),
        toInactiveReaderCandidate(progress, now, options)
      ].filter((candidate): candidate is PushCandidate => Boolean(candidate))
    )
    .sort((left, right) => left.scheduledAt.getTime() - right.scheduledAt.getTime());
}

async function listOpenedAppNoReadCandidates(db: DbClient, now: Date, options: PushNotificationOptions): Promise<PushCandidate[]> {
  const events = await db.analyticsEvent.findMany({
    where: {
      source: "miniapp",
      label: "открыл Mini App",
      occurredAt: { lte: hoursAgo(now, options.openedAppNoReadDelayHours) }
    },
    include: { user: true },
    orderBy: { occurredAt: "desc" },
    take: options.limit * 3
  });
  const seenUserIds = new Set<string>();
  const candidates: PushCandidate[] = [];

  for (const event of events) {
    if (seenUserIds.has(event.userId)) continue;
    seenUserIds.add(event.userId);
    const hasProgress = await db.readingProgress.findFirst({
      where: { userId: event.userId },
      select: { id: true }
    });
    if (hasProgress) continue;

    const candidate = toOpenedAppNoReadCandidate(event, now, options);
    if (candidate) candidates.push(candidate);
    if (candidates.length >= options.limit) break;
  }

  return candidates;
}

async function sendPush(input: {
  db: DbClient;
  bot: Bot;
  miniAppUrl: string;
  candidate: PushCandidate;
  now: Date;
  options: PushNotificationOptions;
}): Promise<"sent" | "suppressed" | "failed"> {
  const { db, bot, miniAppUrl, candidate, now, options } = input;
  if (await hasRecentDecision(db, candidate)) return "suppressed";

  await recordPushAnalytics(db, "push_scheduled", candidate, {}, now);

  if (await hasActiveAccess(db, candidate.userId, now)) {
    await recordPushAnalytics(db, "push_suppressed_paid", candidate, { suppressionReason: "active_access" }, now);
    return "suppressed";
  }

  if (await hasTargetCompleted(db, candidate)) {
    await recordPushAnalytics(db, "push_suppressed_target_completed", candidate, { suppressionReason: "target_completed" }, now);
    return "suppressed";
  }

  if (await hasRecentDuplicateSent(db, candidate, now, options)) {
    await recordPushAnalytics(db, "push_suppressed_duplicate", candidate, { suppressionReason: "duplicate_recently_sent" }, now);
    return "suppressed";
  }

  const frequencyCapReason = await getFrequencyCapReason(db, candidate.userId, now, options);
  if (frequencyCapReason) {
    await recordPushAnalytics(db, "push_suppressed_frequency_cap", candidate, { suppressionReason: frequencyCapReason }, now);
    return "suppressed";
  }

  try {
    const readerUrl = buildReaderUrl(miniAppUrl, candidate);
    const keyboard = new InlineKeyboard().webApp("Продолжить", readerUrl);
    await bot.api.sendMessage(candidate.userId, candidate.messageText, { reply_markup: keyboard });
    await recordPushAnalytics(db, "push_sent", candidate, { sentAt: now.toISOString(), deepLink: readerUrl }, now);
    return "sent";
  } catch (error) {
    const failureReason = error instanceof Error ? error.message : String(error);
    console.error("Push notification send failed", {
      userId: candidate.userId,
      scenario: candidate.scenario,
      bookId: candidate.bookId,
      chapterNumber: candidate.chapterNumber,
      error
    });
    await recordPushAnalytics(db, "push_failed", candidate, { sentAt: now.toISOString(), failureReason }, now);
    return "failed";
  }
}

export async function runPushNotificationWorkerOnce(input: {
  db: DbClient;
  bot: Bot;
  miniAppUrl: string;
  now?: Date;
  options?: Partial<PushNotificationOptions>;
}): Promise<{ candidates: number; sent: number; suppressed: number; failed: number }> {
  const now = input.now ?? new Date();
  const options = { ...defaultPushNotificationOptions, ...input.options };
  const oldestEligibleAt = hoursAgo(
    now,
    Math.min(
      options.openedAppNoReadDelayHours,
      options.chapter1DelayHours,
      options.inactiveReaderDelayHours,
      options.nearPaywallDelayHours
    )
  );
  const [progressItems, openedAppNoReadCandidates] = await Promise.all([
    input.db.readingProgress.findMany({
    where: {
      updatedAt: { lte: oldestEligibleAt },
      book: { status: "published" }
    },
    include: { user: true, book: true },
    orderBy: { updatedAt: "asc" },
    take: options.limit
    }),
    listOpenedAppNoReadCandidates(input.db, now, options)
  ]);
  const candidates = [...openedAppNoReadCandidates, ...buildCandidates(progressItems, now, options)]
    .sort((left, right) => left.scheduledAt.getTime() - right.scheduledAt.getTime())
    .slice(0, options.limit);
  const result = { candidates: candidates.length, sent: 0, suppressed: 0, failed: 0 };

  for (const candidate of candidates) {
    const status = await sendPush({
      db: input.db,
      bot: input.bot,
      miniAppUrl: input.miniAppUrl,
      candidate,
      now,
      options
    });
    result[status] += 1;
  }

  return result;
}

export function startPushNotificationWorker(input: {
  db: DbClient;
  bot: Bot;
  miniAppUrl: string;
  options?: Partial<PushNotificationOptions>;
}): { stop: () => void; runOnce: () => Promise<{ candidates: number; sent: number; suppressed: number; failed: number }> } {
  const options = { ...defaultPushNotificationOptions, ...input.options };
  let isRunning = false;

  const runOnce = async () => {
    if (isRunning) return { candidates: 0, sent: 0, suppressed: 0, failed: 0 };
    isRunning = true;
    try {
      return await runPushNotificationWorkerOnce({ ...input, options });
    } finally {
      isRunning = false;
    }
  };

  if (!options.enabled) {
    return { stop: () => undefined, runOnce };
  }

  const interval = setInterval(() => {
    runOnce().catch((error) => {
      console.error("Push notification worker failed", error);
    });
  }, options.intervalMs);

  runOnce().catch((error) => {
    console.error("Push notification worker failed", error);
  });

  return {
    stop: () => clearInterval(interval),
    runOnce
  };
}
