import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { TestDb } from "../test/db.js";
import { createTestDb } from "../test/db.js";
import { getBookDetailForUser, listBooksForUser } from "./books.js";

let testDb: TestDb;

beforeEach(async () => {
  testDb = await createTestDb();
  await testDb.db.telegramUser.create({ data: { id: "5100586818" } });
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

describe("book ratings", () => {
  it("returns deterministic rating data in the 8 to 10 score range", async () => {
    const first = await getBookDetailForUser(testDb.db, "5100586818", "book-1");
    const second = await getBookDetailForUser(testDb.db, "5100586818", "book-1");

    expect(first?.rating).toEqual(second?.rating);
    expect(first?.rating.averageScore).toBeGreaterThanOrEqual(8);
    expect(first?.rating.averageScore).toBeLessThanOrEqual(10);
    expect(first?.rating.reviewCount).toBeGreaterThan(0);
    expect(first?.rating.distribution).toHaveLength(10);
    expect(first?.rating.distribution.reduce((sum, row) => sum + row.count, 0)).toBe(first?.rating.reviewCount);
  });

  it("includes the same deterministic rating in book lists", async () => {
    const [book] = await listBooksForUser(testDb.db, "5100586818");

    expect(book?.rating.averageScore).toBeGreaterThanOrEqual(8);
    expect(book?.rating.averageScore).toBeLessThanOrEqual(10);
    expect(book?.rating.distribution.map((row) => row.score)).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
  });
});
