import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

export type TestDb = {
  db: PrismaClient;
  cleanup: () => Promise<void>;
};

const SCHEMA_SQL = [
  `CREATE TABLE "TelegramUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE TABLE "Book" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "description" TEXT,
    "tagsJson" TEXT,
    "coverPath" TEXT,
    "chapterCount" INTEGER NOT NULL,
    "freeChapterLimit" INTEGER NOT NULL,
    "sourceEpubFile" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'published',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE TABLE "Chapter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "contentPath" TEXT NOT NULL,
    "wordCount" INTEGER,
    CONSTRAINT "Chapter_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE "ReadingProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "chapterNumber" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "percent" REAL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReadingProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "TelegramUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReadingProgress_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE "UserAccess" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "subscriptionUntil" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "TelegramUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "providerPayload" TEXT NOT NULL,
    "planId" TEXT NOT NULL DEFAULT 'month',
    "starsAmount" INTEGER NOT NULL,
    "accessDays" INTEGER NOT NULL DEFAULT 30,
    "status" TEXT NOT NULL,
    "rawPayload" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" DATETIME,
    CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "TelegramUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "username" TEXT,
    "source" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "metadata" TEXT,
    "occurredAt" DATETIME NOT NULL,
    "flushedAt" DATETIME,
    CONSTRAINT "AnalyticsEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "TelegramUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE "BotStartEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "username" TEXT,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isFirstStart" BOOLEAN NOT NULL,
    CONSTRAINT "BotStartEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "TelegramUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE "TelegramAdsSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "collectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "rawPayload" TEXT
  )`,
  `CREATE TABLE "TelegramAdMetric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "snapshotId" TEXT NOT NULL,
    "adKey" TEXT NOT NULL,
    "adTitle" TEXT NOT NULL,
    "views" INTEGER NOT NULL,
    "clicks" INTEGER NOT NULL,
    "actions" INTEGER NOT NULL,
    "spent" REAL NOT NULL,
    CONSTRAINT "TelegramAdMetric_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "TelegramAdsSnapshot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE "TelegramAdActionDelta" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "adKey" TEXT NOT NULL,
    "adTitle" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "observedFrom" DATETIME NOT NULL,
    "observedTo" DATETIME NOT NULL,
    "fromSnapshotId" TEXT,
    "toSnapshotId" TEXT
  )`,
  `CREATE TABLE "UserAttribution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "botStartEventId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "primarySource" TEXT,
    "candidatesJson" TEXT,
    "matchedWindowFrom" DATETIME NOT NULL,
    "matchedWindowTo" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserAttribution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "TelegramUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserAttribution_botStartEventId_fkey" FOREIGN KEY ("botStartEventId") REFERENCES "BotStartEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE "PaywallWinbackImpression" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "shownAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaywallWinbackImpression_userId_fkey" FOREIGN KEY ("userId") REFERENCES "TelegramUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX "Chapter_bookId_number_key" ON "Chapter"("bookId", "number")`,
  `CREATE UNIQUE INDEX "ReadingProgress_userId_bookId_key" ON "ReadingProgress"("userId", "bookId")`,
  `CREATE UNIQUE INDEX "Payment_providerPayload_key" ON "Payment"("providerPayload")`,
  `CREATE INDEX "AnalyticsEvent_flushedAt_occurredAt_idx" ON "AnalyticsEvent"("flushedAt", "occurredAt")`,
  `CREATE INDEX "BotStartEvent_occurredAt_idx" ON "BotStartEvent"("occurredAt")`,
  `CREATE INDEX "BotStartEvent_userId_idx" ON "BotStartEvent"("userId")`,
  `CREATE INDEX "TelegramAdsSnapshot_collectedAt_idx" ON "TelegramAdsSnapshot"("collectedAt")`,
  `CREATE INDEX "TelegramAdsSnapshot_status_idx" ON "TelegramAdsSnapshot"("status")`,
  `CREATE UNIQUE INDEX "TelegramAdMetric_snapshotId_adKey_key" ON "TelegramAdMetric"("snapshotId", "adKey")`,
  `CREATE INDEX "TelegramAdMetric_adKey_idx" ON "TelegramAdMetric"("adKey")`,
  `CREATE INDEX "TelegramAdActionDelta_observedFrom_idx" ON "TelegramAdActionDelta"("observedFrom")`,
  `CREATE INDEX "TelegramAdActionDelta_observedTo_idx" ON "TelegramAdActionDelta"("observedTo")`,
  `CREATE INDEX "TelegramAdActionDelta_adKey_idx" ON "TelegramAdActionDelta"("adKey")`,
  `CREATE UNIQUE INDEX "UserAttribution_botStartEventId_key" ON "UserAttribution"("botStartEventId")`,
  `CREATE INDEX "UserAttribution_userId_idx" ON "UserAttribution"("userId")`,
  `CREATE INDEX "UserAttribution_status_idx" ON "UserAttribution"("status")`,
  `CREATE INDEX "UserAttribution_createdAt_idx" ON "UserAttribution"("createdAt")`,
  `CREATE UNIQUE INDEX "PaywallWinbackImpression_userId_offerId_key" ON "PaywallWinbackImpression"("userId", "offerId")`
];

export async function createTestDb(): Promise<TestDb> {
  const dir = mkdtempSync(path.join(tmpdir(), "novell-reader-test-"));
  const databaseUrl = `file:${path.join(dir, "test.db")}`;
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

  for (const statement of SCHEMA_SQL) {
    await db.$executeRawUnsafe(statement);
  }

  return {
    db,
    cleanup: async () => {
      await db.$disconnect();
      rmSync(dir, { recursive: true, force: true });
    }
  };
}
