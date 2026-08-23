import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { TestDb } from "../test/db.js";
import { createTestDb } from "../test/db.js";
import { importImportedMetadata } from "./importedMetadata.js";

describe("imported metadata restore", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
  });

  afterEach(async () => {
    await testDb.cleanup();
  });

  it("restores book and chapter rows from existing imported files and metadata", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "novell-reader-imported-metadata-"));
    const outputDir = path.join(tempDir, "imported");
    const bookId = "novelchad-book-id";
    await fs.mkdir(path.join(outputDir, bookId, "chapters"), { recursive: true });
    await fs.writeFile(path.join(outputDir, bookId, "cover.webp"), "cover");
    await fs.writeFile(path.join(outputDir, bookId, "chapters", "2.html"), "<p>Глава 2</p>");
    await fs.writeFile(path.join(outputDir, bookId, "chapters", "1.html"), "<p>Глава 1</p>");

    const metadataFile = path.join(tempDir, "novelchad-metadata.json");
    await fs.writeFile(
      metadataFile,
      JSON.stringify([
        {
          id: bookId,
          title: "Тестовая книга",
          author: "Автор",
          description: "Описание",
          tagsJson: JSON.stringify(["Романтика", "Драма"]),
          coverPath: path.join(bookId, "cover.webp"),
          chapterCount: 99,
          freeChapterLimit: 7,
          sourceEpubFile: "https://novelchad.ru/novel/book-id",
          status: "published"
        }
      ])
    );

    const summary = await importImportedMetadata({ db: testDb.db, metadataFile, outputDir });

    expect(summary).toEqual({ importedBooks: 1, importedChapters: 2, skippedBooks: [] });
    await expect(testDb.db.book.findUnique({ where: { id: bookId } })).resolves.toEqual(
      expect.objectContaining({
        id: bookId,
        title: "Тестовая книга",
        author: "Автор",
        description: "Описание",
        tagsJson: JSON.stringify(["Романтика", "Драма"]),
        coverPath: path.join(bookId, "cover.webp"),
        chapterCount: 2,
        freeChapterLimit: 7,
        sourceEpubFile: "https://novelchad.ru/novel/book-id",
        status: "published"
      })
    );
    await expect(testDb.db.chapter.findMany({ where: { bookId }, orderBy: { number: "asc" } })).resolves.toEqual([
      expect.objectContaining({ bookId, number: 1, title: "Глава 1", contentPath: path.join(bookId, "chapters", "1.html") }),
      expect.objectContaining({ bookId, number: 2, title: "Глава 2", contentPath: path.join(bookId, "chapters", "2.html") })
    ]);
  });
});
