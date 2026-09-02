import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { TestDb } from "../test/db.js";
import { createTestDb } from "../test/db.js";
import { listUnattributedBotStartEvents, recordBotStartEvent } from "./botStarts.js";

let testDb: TestDb;

beforeEach(async () => {
  testDb = await createTestDb();
  await testDb.db.telegramUser.create({ data: { id: "5100586818", username: "barboruss" } });
});

afterEach(async () => {
  await testDb?.cleanup();
});

describe("bot start repository", () => {
  it("marks only the user's first start event as first start", async () => {
    const first = await recordBotStartEvent(testDb.db, {
      userId: "5100586818",
      username: "barboruss",
      occurredAt: new Date("2026-09-01T09:00:00.000Z")
    });
    const second = await recordBotStartEvent(testDb.db, {
      userId: "5100586818",
      username: "barboruss",
      occurredAt: new Date("2026-09-01T09:01:00.000Z")
    });

    expect(first.isFirstStart).toBe(true);
    expect(second.isFirstStart).toBe(false);
  });

  it("lists old bot starts without attribution in occurrence order", async () => {
    const first = await recordBotStartEvent(testDb.db, {
      userId: "5100586818",
      occurredAt: new Date("2026-09-01T09:00:00.000Z")
    });
    const second = await recordBotStartEvent(testDb.db, {
      userId: "5100586818",
      occurredAt: new Date("2026-09-01T09:01:00.000Z")
    });
    await testDb.db.userAttribution.create({
      data: {
        userId: "5100586818",
        botStartEventId: first.id,
        status: "unknown",
        matchedWindowFrom: new Date("2026-09-01T08:59:00.000Z"),
        matchedWindowTo: new Date("2026-09-01T09:03:00.000Z")
      }
    });

    const starts = await listUnattributedBotStartEvents(
      testDb.db,
      new Date("2026-09-01T09:02:00.000Z"),
      10
    );

    expect(starts.map((start) => start.id)).toEqual([second.id]);
  });
});
