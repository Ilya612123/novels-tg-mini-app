import type { BookSummary } from "@novell-reader/shared";

export const CATALOG_SECTION_BOOK_LIMIT = 10;

export type CatalogCategory = "continue-reading" | "popular" | "new" | "weekly-best" | "reading-now" | "club-proofread";

export function getCatalogCategoryTitle(category: CatalogCategory): string {
  if (category === "continue-reading") return "Продолжить чтение";
  if (category === "popular") return "Популярное сейчас";
  if (category === "new") return "Свежие новинки";
  if (category === "weekly-best") return "Лучшие за неделю";
  if (category === "reading-now") return "Сейчас читают";
  return "Вычитано Клубом Читателей";
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

function stableHash(value: string): number {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

export function sortByStableRandomCategory(books: BookSummary[], category: CatalogCategory): BookSummary[] {
  return [...books].sort((first, second) => stableHash(`${category}:${first.id}`) - stableHash(`${category}:${second.id}`));
}

export function getCatalogCategoryBooks(books: BookSummary[], category: CatalogCategory): BookSummary[] {
  if (category === "continue-reading") return sortByProgressUpdatedAtDesc(books.filter((book) => book.progress));
  if (category === "popular") return sortByPopularityDesc(books);
  if (category === "weekly-best" || category === "reading-now" || category === "club-proofread") {
    return sortByStableRandomCategory(books, category);
  }
  return books;
}
