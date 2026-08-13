export type ReadingProgressSummary = {
  bookId: string;
  chapterNumber: number;
  percent: number | null;
  updatedAt: string;
};

export type RatingDistributionRow = {
  score: number;
  count: number;
  percent: number;
};

export type BookRatingSummary = {
  averageScore: number;
  reviewCount: number;
  distribution: RatingDistributionRow[];
};

export type BookSummary = {
  id: string;
  title: string;
  author: string | null;
  description: string | null;
  language?: string | null;
  tags?: string[];
  coverUrl: string | null;
  chapterCount: number;
  freeChapterLimit: number;
  rating: BookRatingSummary;
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
