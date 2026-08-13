import fs from "node:fs/promises";
import path from "node:path";
import type { BookSummary, ChapterDto, ReadingProgressSummary } from "@novell-reader/shared";
import type { ReadingProgress } from "@prisma/client";
import * as cheerio from "cheerio";
import type { DbClient } from "../db.js";
import { getActiveAccess } from "../repositories/access.js";
import { getBookById, getChapterByNumber, listPublishedBooks } from "../repositories/books.js";
import { getProgressForBook, listProgressForUser } from "../repositories/progress.js";
import { getReadableChapterState } from "./access.js";
import { generateStaticBookRating } from "./ratings.js";

function progressSummary(progress: ReadingProgress | null): ReadingProgressSummary | null {
  if (!progress) return null;
  return {
    bookId: progress.bookId,
    chapterNumber: progress.chapterNumber,
    percent: progress.percent,
    updatedAt: progress.updatedAt.toISOString()
  };
}

function coverUrl(coverPath: string | null): string | null {
  return coverPath ? `/content/imported/${coverPath.replaceAll("\\", "/")}` : null;
}

function normalizeTitle(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLocaleLowerCase("ru");
}

function stripDuplicatedLeadingTitle(html: string, title: string): string {
  const $ = cheerio.load(html, null, false);
  const root = $.root();
  const firstContentNode = root
    .contents()
    .toArray()
    .find((node) => node.type !== "text" || $(node).text().trim());

  if (!firstContentNode || firstContentNode.type !== "tag") return html;

  const firstElement = $(firstContentNode);
  const tagName = firstElement.prop("tagName")?.toLowerCase();
  if (!tagName || !["h1", "h2", "h3"].includes(tagName)) return html;
  if (normalizeTitle(firstElement.text()) !== normalizeTitle(title)) return html;

  firstElement.remove();
  return root.html() ?? "";
}

export async function listBooksForUser(db: DbClient, userId: string): Promise<BookSummary[]> {
  const [books, progress] = await Promise.all([listPublishedBooks(db), listProgressForUser(db, userId)]);
  const progressByBook = new Map(progress.map((item) => [item.bookId, item]));

  return books.map((book) => ({
    id: book.id,
    title: book.title,
    author: book.author,
    description: book.description,
    coverUrl: coverUrl(book.coverPath),
    chapterCount: book.chapterCount,
    freeChapterLimit: book.freeChapterLimit,
    rating: generateStaticBookRating(book.id),
    progress: progressSummary(progressByBook.get(book.id) ?? null)
  }));
}

export async function getBookDetailForUser(db: DbClient, userId: string, bookId: string): Promise<BookSummary | null> {
  const [book, progress] = await Promise.all([getBookById(db, bookId), getProgressForBook(db, userId, bookId)]);
  if (!book || book.status !== "published") return null;

  return {
    id: book.id,
    title: book.title,
    author: book.author,
    description: book.description,
    coverUrl: coverUrl(book.coverPath),
    chapterCount: book.chapterCount,
    freeChapterLimit: book.freeChapterLimit,
    rating: generateStaticBookRating(book.id),
    progress: progressSummary(progress)
  };
}

export async function getChapterForUser(
  db: DbClient,
  userId: string,
  bookId: string,
  chapterNumber: number,
  contentRoot = path.resolve(process.cwd(), "../..", "content/imported")
): Promise<ChapterDto | { canRead: false; reason: "paywall" } | null> {
  const [book, chapter, access] = await Promise.all([
    getBookById(db, bookId),
    getChapterByNumber(db, bookId, chapterNumber),
    getActiveAccess(db, userId)
  ]);
  if (!book || book.status !== "published" || !chapter) return null;

  const state = getReadableChapterState({
    chapterNumber,
    totalChapters: book.chapterCount,
    freeChapterLimit: book.freeChapterLimit,
    subscriptionUntil: access?.subscriptionUntil ?? null
  });

  if (!state.canRead) return state;

  const html = stripDuplicatedLeadingTitle(await fs.readFile(path.join(contentRoot, chapter.contentPath), "utf8"), chapter.title);
  return {
    id: chapter.id,
    bookId: chapter.bookId,
    number: chapter.number,
    title: chapter.title,
    html,
    canRead: true
  };
}
