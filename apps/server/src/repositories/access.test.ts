import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { TestDb } from "../test/db.js";
import { createTestDb } from "../test/db.js";
import { extendAccessByThirtyDays, getActiveAccess } from "./access.js";

let testDb: TestDb;

beforeEach(async () => {
  testDb = await createTestDb();
  await testDb.db.telegramUser.create({ data: { id: "5100586818", username: "barboruss" } });
});

afterEach(async () => {
  await testDb?.cleanup();
});

describe("access repository", () => {
  it("extends from now when no active access exists", async () => {
    const now = new Date("2026-08-11T09:00:00.000Z");
    const access = await extendAccessByThirtyDays(testDb.db, "5100586818", now);

    expect(access.subscriptionUntil.toISOString()).toBe("2026-09-10T09:00:00.000Z");
    await expect(getActiveAccess(testDb.db, "5100586818", now)).resolves.not.toBeNull();
  });

  it("extends from current future subscriptionUntil", async () => {
    const now = new Date("2026-08-11T09:00:00.000Z");
    await extendAccessByThirtyDays(testDb.db, "5100586818", now);
    const access = await extendAccessByThirtyDays(testDb.db, "5100586818", now);

    expect(access.subscriptionUntil.toISOString()).toBe("2026-10-10T09:00:00.000Z");
  });
});
