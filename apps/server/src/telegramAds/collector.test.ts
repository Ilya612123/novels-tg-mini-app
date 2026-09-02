import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TestDb } from "../test/db.js";
import { createTestDb } from "../test/db.js";
import { collectTelegramAdsSnapshot } from "./collector.js";

let testDb: TestDb;

beforeEach(async () => {
  testDb = await createTestDb();
});

afterEach(async () => {
  await testDb?.cleanup();
});

describe("Telegram Ads collector", () => {
  it("passes configured request headers and stores parsed account HTML metrics", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => "text/html" },
      text: async () => `<script>ajInit({"state":{"initialAdsList":{"items":[{"ad_id":25,"title":"фанфики","views":1356,"clicks":91,"actions":44,"spent":1.084}]}}});</script>`
    });

    const result = await collectTelegramAdsSnapshot(testDb.db, {
      headers: { cookie: "stel_token=secret", "user-agent": "collector" },
      fetchImpl
    });

    const metric = await testDb.db.telegramAdMetric.findFirstOrThrow();
    expect(fetchImpl).toHaveBeenCalledWith("https://ads.telegram.org/account", {
      headers: { cookie: "stel_token=secret", "user-agent": "collector" }
    });
    expect(result).toEqual({ ok: true, metricsCount: 1, deltasCreated: 0 });
    expect(metric).toMatchObject({ adKey: "25", adTitle: "фанфики", actions: 44 });
  });

  it("marks login page responses as likely expired auth", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => "text/html" },
      text: async () => `<html><body><a href="/auth">Log in with Telegram</a></body></html>`
    });

    const result = await collectTelegramAdsSnapshot(testDb.db, {
      headers: { cookie: "expired" },
      fetchImpl
    });

    expect(result).toMatchObject({ ok: false, authLikelyExpired: true });
  });
});
