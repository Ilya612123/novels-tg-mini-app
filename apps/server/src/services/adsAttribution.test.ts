import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { recordBotStartEvent } from "../repositories/botStarts.js";
import type { TestDb } from "../test/db.js";
import { createTestDb } from "../test/db.js";
import { matchPendingTelegramAdsAttributions } from "./adsAttribution.js";

let testDb: TestDb;

beforeEach(async () => {
  testDb = await createTestDb();
  await testDb.db.telegramUser.create({ data: { id: "5100586818", username: "barboruss" } });
});

afterEach(async () => {
  await testDb?.cleanup();
});

describe("Telegram Ads attribution matcher", () => {
  it("creates likely attribution when one action delta overlaps the start window", async () => {
    const start = await recordBotStartEvent(testDb.db, {
      userId: "5100586818",
      occurredAt: new Date("2026-09-01T12:00:10.000Z")
    });
    await testDb.db.telegramAdActionDelta.create({
      data: {
        adKey: "romance",
        adTitle: "романтика",
        delta: 1,
        observedFrom: new Date("2026-09-01T12:00:00.000Z"),
        observedTo: new Date("2026-09-01T12:00:20.000Z")
      }
    });

    const summary = await matchPendingTelegramAdsAttributions(testDb.db, {
      now: new Date("2026-09-01T12:12:00.000Z"),
      beforeWindowSeconds: 60,
      afterWindowSeconds: 180,
      unknownAfterSeconds: 600,
      limit: 10
    });

    const attribution = await testDb.db.userAttribution.findUniqueOrThrow({
      where: { botStartEventId: start.id }
    });
    expect(summary).toEqual({ processed: 1, likely: 1, ambiguous: 0, unknown: 0 });
    expect(attribution.status).toBe("likely");
    expect(attribution.primarySource).toBe("романтика");
    expect(JSON.parse(attribution.candidatesJson ?? "[]")).toEqual([{ adKey: "romance", adTitle: "романтика", delta: 1 }]);
  });

  it("creates ambiguous attribution when multiple action deltas overlap the start window", async () => {
    const start = await recordBotStartEvent(testDb.db, {
      userId: "5100586818",
      occurredAt: new Date("2026-09-01T12:00:10.000Z")
    });
    await testDb.db.telegramAdActionDelta.createMany({
      data: [
        {
          adKey: "romance",
          adTitle: "романтика",
          delta: 1,
          observedFrom: new Date("2026-09-01T12:00:00.000Z"),
          observedTo: new Date("2026-09-01T12:00:20.000Z")
        },
        {
          adKey: "ranobe",
          adTitle: "ранобэ",
          delta: 1,
          observedFrom: new Date("2026-09-01T12:00:00.000Z"),
          observedTo: new Date("2026-09-01T12:00:20.000Z")
        }
      ]
    });

    const summary = await matchPendingTelegramAdsAttributions(testDb.db, {
      now: new Date("2026-09-01T12:12:00.000Z"),
      beforeWindowSeconds: 60,
      afterWindowSeconds: 180,
      unknownAfterSeconds: 600,
      limit: 10
    });

    const attribution = await testDb.db.userAttribution.findUniqueOrThrow({
      where: { botStartEventId: start.id }
    });
    const candidateTitles = JSON.parse(attribution.candidatesJson ?? "[]").map((candidate: { adTitle: string }) => candidate.adTitle);
    expect(summary).toEqual({ processed: 1, likely: 0, ambiguous: 1, unknown: 0 });
    expect(attribution.status).toBe("ambiguous");
    expect(attribution.primarySource).toBeNull();
    expect(candidateTitles.sort()).toEqual(["ранобэ", "романтика"]);
  });

  it("creates unknown attribution for old bot starts without overlapping deltas", async () => {
    const start = await recordBotStartEvent(testDb.db, {
      userId: "5100586818",
      occurredAt: new Date("2026-09-01T12:00:10.000Z")
    });

    const summary = await matchPendingTelegramAdsAttributions(testDb.db, {
      now: new Date("2026-09-01T12:12:00.000Z"),
      beforeWindowSeconds: 60,
      afterWindowSeconds: 180,
      unknownAfterSeconds: 600,
      limit: 10
    });

    const attribution = await testDb.db.userAttribution.findUniqueOrThrow({
      where: { botStartEventId: start.id }
    });
    expect(summary).toEqual({ processed: 1, likely: 0, ambiguous: 0, unknown: 1 });
    expect(attribution.status).toBe("unknown");
    expect(attribution.primarySource).toBeNull();
    expect(JSON.parse(attribution.candidatesJson ?? "[]")).toEqual([]);
  });
});
