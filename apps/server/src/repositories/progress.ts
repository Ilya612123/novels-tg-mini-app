import type { ReadingProgress } from "@prisma/client";
import type { DbClient } from "../db.js";

export async function upsertReadingProgress(
  db: DbClient,
  input: {
    userId: string;
    bookId: string;
    chapterNumber: number;
    position: number;
    percent: number | null;
  }
): Promise<ReadingProgress> {
  return db.readingProgress.upsert({
    where: {
      userId_bookId: {
        userId: input.userId,
        bookId: input.bookId
      }
    },
    create: input,
    update: {
      chapterNumber: input.chapterNumber,
      position: input.position,
      percent: input.percent
    }
  });
}

export async function listProgressForUser(db: DbClient, userId: string): Promise<ReadingProgress[]> {
  return db.readingProgress.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" }
  });
}

export async function getProgressForBook(db: DbClient, userId: string, bookId: string): Promise<ReadingProgress | null> {
  return db.readingProgress.findUnique({
    where: {
      userId_bookId: {
        userId,
        bookId
      }
    }
  });
}
