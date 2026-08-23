import fs from "node:fs/promises";
import path from "node:path";
import type { DbClient } from "../db.js";

export type ImportedBookMetadata = {
  id: string;
  title: string;
  author: string | null;
  description: string | null;
  tagsJson: string | null;
  coverPath: string | null;
  chapterCount: number;
  freeChapterLimit: number;
  sourceEpubFile: string;
  status: string;
};

export type ImportImportedMetadataInput = {
  db: DbClient;
  metadataFile: string;
  outputDir: string;
};

export type ImportImportedMetadataSummary = {
  importedBooks: number;
  importedChapters: number;
  skippedBooks: string[];
};

function isImportedBookMetadata(value: unknown): value is ImportedBookMetadata {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    (typeof item.author === "string" || item.author === null) &&
    (typeof item.description === "string" || item.description === null) &&
    (typeof item.tagsJson === "string" || item.tagsJson === null) &&
    (typeof item.coverPath === "string" || item.coverPath === null) &&
    typeof item.chapterCount === "number" &&
    typeof item.freeChapterLimit === "number" &&
    typeof item.sourceEpubFile === "string" &&
    typeof item.status === "string"
  );
}

async function readMetadata(metadataFile: string): Promise<ImportedBookMetadata[]> {
  const parsed = JSON.parse(await fs.readFile(metadataFile, "utf8")) as unknown;
  if (!Array.isArray(parsed) || !parsed.every(isImportedBookMetadata)) {
    throw new Error(`Invalid imported metadata file: ${metadataFile}`);
  }
  return parsed;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

async function listChapterNumbers(chaptersDir: string): Promise<number[]> {
  const files = await fs.readdir(chaptersDir);
  return files
    .filter((file) => file.endsWith(".html"))
    .map((file) => Number(file.slice(0, -".html".length)))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
}

export async function importImportedMetadata(input: ImportImportedMetadataInput): Promise<ImportImportedMetadataSummary> {
  const metadata = await readMetadata(input.metadataFile);
  const summary: ImportImportedMetadataSummary = { importedBooks: 0, importedChapters: 0, skippedBooks: [] };

  for (const book of metadata) {
    const bookDir = path.join(input.outputDir, book.id);
    const chaptersDir = path.join(bookDir, "chapters");
    let chapterNumbers: number[];

    try {
      chapterNumbers = await listChapterNumbers(chaptersDir);
    } catch {
      summary.skippedBooks.push(book.id);
      continue;
    }

    if (chapterNumbers.length === 0) {
      summary.skippedBooks.push(book.id);
      continue;
    }

    const coverPath = book.coverPath && (await fileExists(path.join(input.outputDir, book.coverPath))) ? book.coverPath : null;

    await input.db.book.upsert({
      where: { id: book.id },
      create: {
        id: book.id,
        title: book.title,
        author: book.author,
        description: book.description,
        tagsJson: book.tagsJson,
        coverPath,
        chapterCount: chapterNumbers.length,
        freeChapterLimit: book.freeChapterLimit,
        sourceEpubFile: book.sourceEpubFile,
        status: book.status
      },
      update: {
        title: book.title,
        author: book.author,
        description: book.description,
        tagsJson: book.tagsJson,
        coverPath,
        chapterCount: chapterNumbers.length,
        freeChapterLimit: book.freeChapterLimit,
        sourceEpubFile: book.sourceEpubFile,
        status: book.status
      }
    });

    await input.db.chapter.deleteMany({ where: { bookId: book.id } });
    await input.db.chapter.createMany({
      data: chapterNumbers.map((number) => ({
        id: `${book.id}-${number}`,
        bookId: book.id,
        number,
        title: `Глава ${number}`,
        contentPath: path.join(book.id, "chapters", `${number}.html`),
        wordCount: null
      }))
    });

    summary.importedBooks += 1;
    summary.importedChapters += chapterNumbers.length;
  }

  return summary;
}
