import type { Book, Chapter } from "@prisma/client";
import type { DbClient } from "../db.js";

export async function listPublishedBooks(db: DbClient): Promise<Book[]> {
  return db.book.findMany({
    where: { status: "published" },
    orderBy: { createdAt: "desc" }
  });
}

export async function getBookById(db: DbClient, bookId: string): Promise<Book | null> {
  return db.book.findUnique({ where: { id: bookId } });
}

export async function getChapterByNumber(db: DbClient, bookId: string, chapterNumber: number): Promise<Chapter | null> {
  return db.chapter.findUnique({
    where: {
      bookId_number: {
        bookId,
        number: chapterNumber
      }
    }
  });
}
