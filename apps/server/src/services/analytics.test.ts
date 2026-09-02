import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Bot } from "grammy";
import type { TestDb } from "../test/db.js";
import { createTestDb } from "../test/db.js";
import { recordAnalyticsEvent } from "../repositories/analytics.js";
import { recordBotStartEvent } from "../repositories/botStarts.js";
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
      chatId: "-1001",
      now: new Date("2026-08-11T09:22:00.000Z")
    });

    expect(result).toEqual({ sent: true, eventCount: 2 });
    expect(sendMessage.mock.calls[0]![1]).toContain("старт бота");
    expect(await testDb.db.analyticsEvent.count({ where: { flushedAt: null } })).toBe(0);
  });

  it("includes event metadata in the Telegram analytics digest", async () => {
    await recordAnalyticsEvent(testDb.db, {
      userId: "5100586818",
      username: "barboruss",
      source: "miniapp",
      label: "искал в Каталоге",
      metadata: { query: "баш", resultCount: 1 },
      occurredAt: new Date("2026-08-11T09:21:03.000Z")
    });

    const sendMessage = vi.fn().mockResolvedValue({});
    await flushAnalyticsToTelegram({
      db: testDb.db,
      bot: { api: { sendMessage } } as unknown as Bot,
      chatId: "-1001",
      now: new Date("2026-08-11T09:22:00.000Z")
    });

    expect(sendMessage.mock.calls[0]![1]).toContain("искал в Каталоге query=баш resultCount=1");
  });

  it("splits large analytics digests into Telegram-sized messages", async () => {
    const occurredAt = new Date("2026-08-11T09:21:03.000Z");
    for (let index = 0; index < 260; index += 1) {
      await recordAnalyticsEvent(testDb.db, {
        userId: "5100586818",
        username: "barboruss",
        source: "miniapp",
        label: `перешел на следующую главу ${index}`,
        occurredAt: new Date(occurredAt.getTime() + index * 1000)
      });
    }

    const sendMessage = vi.fn().mockResolvedValue({});
    const result = await flushAnalyticsToTelegram({
      db: testDb.db,
      bot: { api: { sendMessage } } as unknown as Bot,
      chatId: "-1001",
      now: new Date("2026-08-11T09:30:00.000Z")
    });

    expect(result).toEqual({ sent: true, eventCount: 260 });
    expect(sendMessage.mock.calls.length).toBeGreaterThan(1);
    for (const [, text] of sendMessage.mock.calls) {
      expect(text.length).toBeLessThanOrEqual(4096);
    }
    expect(await testDb.db.analyticsEvent.count({ where: { flushedAt: null } })).toBe(0);
  });

  it("includes Telegram Ads attribution in bot start digest lines", async () => {
    const starts = await Promise.all([
      recordBotStartEvent(testDb.db, {
        userId: "5100586818",
        occurredAt: new Date("2026-08-11T09:21:03.000Z")
      }),
      recordBotStartEvent(testDb.db, {
        userId: "5100586818",
        occurredAt: new Date("2026-08-11T09:21:13.000Z")
      }),
      recordBotStartEvent(testDb.db, {
        userId: "5100586818",
        occurredAt: new Date("2026-08-11T09:21:23.000Z")
      })
    ]);
    await testDb.db.userAttribution.createMany({
      data: [
        {
          userId: "5100586818",
          botStartEventId: starts[0]!.id,
          status: "likely",
          primarySource: "романтика",
          candidatesJson: JSON.stringify([{ adTitle: "романтика" }]),
          matchedWindowFrom: new Date("2026-08-11T09:20:00.000Z"),
          matchedWindowTo: new Date("2026-08-11T09:24:00.000Z")
        },
        {
          userId: "5100586818",
          botStartEventId: starts[1]!.id,
          status: "ambiguous",
          candidatesJson: JSON.stringify([{ adTitle: "романтика" }, { adTitle: "ранобэ" }]),
          matchedWindowFrom: new Date("2026-08-11T09:20:00.000Z"),
          matchedWindowTo: new Date("2026-08-11T09:24:00.000Z")
        },
        {
          userId: "5100586818",
          botStartEventId: starts[2]!.id,
          status: "unknown",
          candidatesJson: JSON.stringify([]),
          matchedWindowFrom: new Date("2026-08-11T09:20:00.000Z"),
          matchedWindowTo: new Date("2026-08-11T09:24:00.000Z")
        }
      ]
    });
    for (const start of starts) {
      await recordAnalyticsEvent(testDb.db, {
        userId: "5100586818",
        source: "bot",
        label: "старт бота",
        metadata: { botStartEventId: start.id },
        occurredAt: start.occurredAt
      });
    }

    const sendMessage = vi.fn().mockResolvedValue({});
    await flushAnalyticsToTelegram({
      db: testDb.db,
      bot: { api: { sendMessage } } as unknown as Bot,
      chatId: "-1001",
      now: new Date("2026-08-11T09:22:00.000Z")
    });

    const text = sendMessage.mock.calls[0]![1];
    expect(text).toContain("атрибуция: likely, романтика");
    expect(text).toContain("атрибуция: ambiguous, варианты: романтика, ранобэ");
    expect(text).toContain("атрибуция: unknown");
  });
});
