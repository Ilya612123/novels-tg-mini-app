import type { BookSummary } from "@novell-reader/shared";

export const CATALOG_SECTION_BOOK_LIMIT = 10;

export type CatalogCategory = "continue-reading" | "popular" | "new";

export function getCatalogCategoryTitle(category: CatalogCategory): string {
  if (category === "continue-reading") return "Продолжить чтение";
  if (category === "popular") return "Популярное сейчас";
  return "Свежие новинки";
}

export function sortByProgressUpdatedAtDesc(books: BookSummary[]): BookSummary[] {
  return [...books].sort((first, second) => {
    const firstUpdatedAt = first.progress ? Date.parse(first.progress.updatedAt) : 0;
    const secondUpdatedAt = second.progress ? Date.parse(second.progress.updatedAt) : 0;
    return secondUpdatedAt - firstUpdatedAt;
  });
}

export function sortByPopularityDesc(books: BookSummary[]): BookSummary[] {
  return [...books].sort((first, second) => {
    const reviewCountDiff = second.rating.reviewCount - first.rating.reviewCount;
    if (reviewCountDiff !== 0) return reviewCountDiff;
    return second.rating.averageScore - first.rating.averageScore;
  });
}

export function getCatalogCategoryBooks(books: BookSummary[], category: CatalogCategory): BookSummary[] {
  if (category === "continue-reading") return sortByProgressUpdatedAtDesc(books.filter((book) => book.progress));
  if (category === "popular") return sortByPopularityDesc(books);
  return books;
}
