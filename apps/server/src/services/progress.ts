import type { ReadingProgress } from "@prisma/client";
import type { DbClient } from "../db.js";
import { upsertReadingProgress } from "../repositories/progress.js";

export type SaveProgressInput = {
  userId: string;
  bookId: string;
  chapterNumber: number;
  position: number;
  percent: number | null;
};

export async function saveProgress(db: DbClient, input: SaveProgressInput): Promise<ReadingProgress> {
  return upsertReadingProgress(db, input);
}
