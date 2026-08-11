export type ReadingProgressSummary = {
  bookId: string;
  chapterNumber: number;
  percent: number | null;
  updatedAt: string;
};

export type BookSummary = {
  id: string;
  title: string;
  author: string | null;
  description: string | null;
  coverUrl: string | null;
  chapterCount: number;
  freeChapterLimit: number;
  progress: ReadingProgressSummary | null;
};

export type ChapterDto = {
  id: string;
  bookId: string;
  number: number;
  title: string;
  html: string;
  canRead: boolean;
};

export type AccessStatusDto = {
  active: boolean;
  subscriptionUntil: string | null;
};
