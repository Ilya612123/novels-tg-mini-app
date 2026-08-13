import fs from "node:fs/promises";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { TestDb } from "../test/db.js";
import { createTestDb } from "../test/db.js";
import { getBookDetailForUser, getChapterForUser, listBooksForUser } from "./books.js";

let testDb: TestDb;
let contentDir: string;

beforeEach(async () => {
  testDb = await createTestDb();
  contentDir = await mkdtemp(path.join(tmpdir(), "novell-reader-content-"));
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
  await fs.rm(contentDir, { recursive: true, force: true });
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

describe("chapters", () => {
  it("removes the duplicated leading chapter title from served html", async () => {
    await fs.mkdir(path.join(contentDir, "book-1", "chapters"), { recursive: true });
    await fs.writeFile(
      path.join(contentDir, "book-1", "chapters", "2.html"),
      "<h2>Глава 2. Вдохновленный ссорой</h2><br />Текст главы"
    );
    await testDb.db.chapter.create({
      data: {
        id: "book-1-2",
        bookId: "book-1",
        number: 2,
        title: "Глава 2. Вдохновленный ссорой",
        contentPath: "book-1/chapters/2.html"
      }
    });

    const chapter = await getChapterForUser(testDb.db, "5100586818", "book-1", 2, contentDir);

    expect(chapter?.canRead).toBe(true);
    if (!chapter?.canRead) throw new Error("Expected readable chapter");
    expect(chapter?.html).toBe("<br>Текст главы");
  });
});
