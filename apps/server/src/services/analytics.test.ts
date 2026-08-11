import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Bot } from "grammy";
import type { TestDb } from "../test/db.js";
import { createTestDb } from "../test/db.js";
import { recordAnalyticsEvent } from "../repositories/analytics.js";
import { flushAnalyticsToTelegram } from "./analytics.js";

let testDb: TestDb;

beforeEach(async () => {
  testDb = await createTestDb();
  await testDb.db.telegramUser.create({ data: { id: "5100586818", username: "barboruss" } });
});

afterEach(async () => {
  await testDb?.cleanup();
});

describe("flushAnalyticsToTelegram", () => {
  it("sends grouped events to channel and marks them flushed", async () => {
    await recordAnalyticsEvent(testDb.db, {
      userId: "5100586818",
      username: "barboruss",
      source: "bot",
      label: "старт бота",
      occurredAt: new Date("2026-08-11T09:21:03.000Z")
    });
    await recordAnalyticsEvent(testDb.db, {
      userId: "5100586818",
      username: "barboruss",
      source: "miniapp",
      label: "открыл Mini App",
      occurredAt: new Date("2026-08-11T09:21:11.000Z")
    });

    const sendMessage = vi.fn().mockResolvedValue({});
    const result = await flushAnalyticsToTelegram({
      db: testDb.db,
      bot: { api: { sendMessage } } as unknown as Bot,
      channelId: "-1001",
      now: new Date("2026-08-11T09:22:00.000Z")
    });

    expect(result).toEqual({ sent: true, eventCount: 2 });
    expect(sendMessage.mock.calls[0]![1]).toContain("старт бота");
    expect(await testDb.db.analyticsEvent.count({ where: { flushedAt: null } })).toBe(0);
  });
});
