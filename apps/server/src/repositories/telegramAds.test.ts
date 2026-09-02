import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { TestDb } from "../test/db.js";
import { createTestDb } from "../test/db.js";
import { recordTelegramAdsCollectionFailure, recordTelegramAdsSnapshot } from "./telegramAds.js";

let testDb: TestDb;

beforeEach(async () => {
  testDb = await createTestDb();
});

afterEach(async () => {
  await testDb?.cleanup();
});

describe("telegram ads repository", () => {
  it("stores a first successful snapshot with metrics and no deltas", async () => {
    const result = await recordTelegramAdsSnapshot(testDb.db, {
      collectedAt: new Date("2026-09-01T09:00:00.000Z"),
      rawPayload: { ok: true },
      metrics: [
        { adKey: "romance", adTitle: "романтика", views: 100, clicks: 7, actions: 4, spent: 1.5 }
      ]
    });

    const snapshot = await testDb.db.telegramAdsSnapshot.findUnique({
      where: { id: result.snapshotId },
      include: { metrics: true }
    });
    const deltas = await testDb.db.telegramAdActionDelta.findMany();

    expect(snapshot?.status).toBe("success");
    expect(snapshot?.rawPayload).toBe('{"ok":true}');
    expect(snapshot?.metrics).toHaveLength(1);
    expect(snapshot?.metrics[0]).toMatchObject({ adKey: "romance", actions: 4 });
    expect(result.deltasCreated).toBe(0);
    expect(deltas).toHaveLength(0);
  });

  it("stores positive action deltas against the previous successful snapshot", async () => {
    await recordTelegramAdsSnapshot(testDb.db, {
      collectedAt: new Date("2026-09-01T09:00:00.000Z"),
      metrics: [{ adKey: "romance", adTitle: "романтика", views: 100, clicks: 7, actions: 4, spent: 1.5 }]
    });

    const result = await recordTelegramAdsSnapshot(testDb.db, {
      collectedAt: new Date("2026-09-01T09:15:00.000Z"),
      metrics: [{ adKey: "romance", adTitle: "романтика", views: 140, clicks: 9, actions: 6, spent: 2.1 }]
    });

    const delta = await testDb.db.telegramAdActionDelta.findFirstOrThrow();
    expect(result.deltasCreated).toBe(1);
    expect(delta).toMatchObject({ adKey: "romance", adTitle: "романтика", delta: 2 });
    expect(delta.observedFrom.toISOString()).toBe("2026-09-01T09:00:00.000Z");
    expect(delta.observedTo.toISOString()).toBe("2026-09-01T09:15:00.000Z");
  });

  it("does not store zero or negative action deltas", async () => {
    await recordTelegramAdsSnapshot(testDb.db, {
      collectedAt: new Date("2026-09-01T09:00:00.000Z"),
      metrics: [
        { adKey: "unchanged", adTitle: "без изменений", views: 100, clicks: 7, actions: 4, spent: 1.5 },
        { adKey: "decreased", adTitle: "уменьшилось", views: 50, clicks: 3, actions: 8, spent: 1.1 }
      ]
    });

    const result = await recordTelegramAdsSnapshot(testDb.db, {
      collectedAt: new Date("2026-09-01T09:15:00.000Z"),
      metrics: [
        { adKey: "unchanged", adTitle: "без изменений", views: 110, clicks: 8, actions: 4, spent: 1.7 },
        { adKey: "decreased", adTitle: "уменьшилось", views: 55, clicks: 4, actions: 7, spent: 1.2 }
      ]
    });

    expect(result.deltasCreated).toBe(0);
    await expect(testDb.db.telegramAdActionDelta.count()).resolves.toBe(0);
  });

  it("stores failed collection snapshots without metrics", async () => {
    const snapshot = await recordTelegramAdsCollectionFailure(testDb.db, {
      collectedAt: new Date("2026-09-01T09:00:00.000Z"),
      errorMessage: "missing session",
      rawPayload: { error: "unauthorized" }
    });

    const metricsCount = await testDb.db.telegramAdMetric.count({ where: { snapshotId: snapshot.id } });
    expect(snapshot).toMatchObject({
      status: "failed",
      errorMessage: "missing session",
      rawPayload: '{"error":"unauthorized"}'
    });
    expect(metricsCount).toBe(0);
  });
});
