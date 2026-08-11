import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { TestDb } from "../test/db.js";
import { createTestDb } from "../test/db.js";
import { upsertReadingProgress } from "./progress.js";

let testDb: TestDb;

beforeEach(async () => {
  testDb = await createTestDb();
  await testDb.db.telegramUser.create({ data: { id: "5100586818", username: "barboruss" } });
  await testDb.db.book.create({
    data: {
      id: "book-1",
      title: "Компенсация за первую любовь",
      chapterCount: 51,
      freeChapterLimit: 17,
      sourceEpubFile: "sample.epub"
    }
  });
});

afterEach(async () => {
  await testDb?.cleanup();
});

describe("upsertReadingProgress", () => {
  it("creates and updates progress by user and book", async () => {
    const first = await upsertReadingProgress(testDb.db, {
      userId: "5100586818",
      bookId: "book-1",
      chapterNumber: 1,
      position: 120,
      percent: 12
    });

    const second = await upsertReadingProgress(testDb.db, {
      userId: "5100586818",
      bookId: "book-1",
      chapterNumber: 2,
      position: 0,
      percent: 20
    });

    expect(second.id).toBe(first.id);
    expect(second.chapterNumber).toBe(2);
    expect(second.percent).toBe(20);
  });
});
