import { Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { BookSummary } from "@novell-reader/shared";
import { BookCard } from "../components/BookCard";
import { CatalogSection } from "../components/CatalogSection";
import {
  CATALOG_SECTION_BOOK_LIMIT,
  getCatalogCategoryBooks,
  type CatalogCategory
} from "./catalogCategories";

const SEARCH_ANALYTICS_DELAY_MS = 500;

function normalizeSearchQuery(query: string): string {
  return query.trim().toLocaleLowerCase("ru-RU");
}

function matchesSearchQuery(book: BookSummary, query: string): boolean {
  const searchableText = [book.title, book.author, ...(book.tags ?? [])].filter(Boolean).join(" ").toLocaleLowerCase("ru-RU");
  return searchableText.includes(query);
}

type CatalogScreenProps = {
  books: BookSummary[];
  onOpenCategory: (category: CatalogCategory) => void;
  onOpenBook: (bookId: string) => void;
  onSearch?: (query: string, resultCount: number) => void;
};

export function CatalogScreen({ books, onOpenCategory, onOpenBook, onSearch }: CatalogScreenProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const normalizedSearchQuery = normalizeSearchQuery(searchQuery);
  const filteredBooks = useMemo(() => {
    if (!normalizedSearchQuery) return books;
    return books.filter((book) => matchesSearchQuery(book, normalizedSearchQuery));
  }, [books, normalizedSearchQuery]);
  const continueReadingBooks = useMemo(() => getCatalogCategoryBooks(books, "continue-reading"), [books]);
  const popularBooks = useMemo(() => getCatalogCategoryBooks(books, "popular"), [books]);
  const newBooks = useMemo(() => getCatalogCategoryBooks(books, "new"), [books]);
  const weeklyBestBooks = useMemo(() => getCatalogCategoryBooks(books, "weekly-best"), [books]);
  const readingNowBooks = useMemo(() => getCatalogCategoryBooks(books, "reading-now"), [books]);
  const clubProofreadBooks = useMemo(() => getCatalogCategoryBooks(books, "club-proofread"), [books]);

  useEffect(() => {
    if (!normalizedSearchQuery || !onSearch) return;

    const timeoutId = window.setTimeout(() => {
      onSearch(normalizedSearchQuery, filteredBooks.length);
    }, SEARCH_ANALYTICS_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [filteredBooks.length, normalizedSearchQuery, onSearch]);

  if (books.length === 0) {
    return <div className="state">Книги пока не импортированы</div>;
  }

  return (
    <main className="screen">
      <header className="screen-header">
        <h1>Книги</h1>
      </header>
      <label className="catalog-search">
        <Search aria-hidden="true" />
        <input
          aria-label="Поиск по книгам"
          autoComplete="off"
          inputMode="search"
          onChange={(event) => setSearchQuery(event.currentTarget.value)}
          placeholder="Поиск"
          ref={searchInputRef}
          type="search"
          value={searchQuery}
        />
        {searchQuery ? (
          <button
            aria-label="Очистить поиск"
            className="catalog-search-clear"
            onClick={() => {
              setSearchQuery("");
              searchInputRef.current?.focus();
            }}
            type="button"
          >
            <X aria-hidden="true" />
          </button>
        ) : null}
      </label>
      {normalizedSearchQuery && filteredBooks.length > 0 ? (
        <section className="book-grid">
          {filteredBooks.map((book) => (
            <BookCard key={book.id} book={book} onOpen={onOpenBook} />
          ))}
        </section>
      ) : normalizedSearchQuery ? (
        <div className="catalog-empty-results">
          <div className="state catalog-empty-search">Ничего не найдено</div>
          <CatalogSection
            category="popular"
            id="catalog-section-popular"
            books={popularBooks.slice(0, CATALOG_SECTION_BOOK_LIMIT)}
            onOpenAll={() => onOpenCategory("popular")}
            onOpenBook={onOpenBook}
          />
        </div>
      ) : (
        <div className="catalog-sections">
          <CatalogSection
            category="continue-reading"
            id="catalog-section-continue-reading"
            books={continueReadingBooks.slice(0, CATALOG_SECTION_BOOK_LIMIT)}
            onOpenAll={() => onOpenCategory("continue-reading")}
            onOpenBook={onOpenBook}
          />
          <CatalogSection
            category="popular"
            id="catalog-section-popular"
            books={popularBooks.slice(0, CATALOG_SECTION_BOOK_LIMIT)}
            onOpenAll={() => onOpenCategory("popular")}
            onOpenBook={onOpenBook}
          />
          <CatalogSection
            category="new"
            id="catalog-section-new"
            books={newBooks.slice(0, CATALOG_SECTION_BOOK_LIMIT)}
            onOpenAll={() => onOpenCategory("new")}
            onOpenBook={onOpenBook}
          />
          <CatalogSection
            category="weekly-best"
            id="catalog-section-weekly-best"
            books={weeklyBestBooks.slice(0, CATALOG_SECTION_BOOK_LIMIT)}
            onOpenAll={() => onOpenCategory("weekly-best")}
            onOpenBook={onOpenBook}
          />
          <CatalogSection
            category="reading-now"
            id="catalog-section-reading-now"
            books={readingNowBooks.slice(0, CATALOG_SECTION_BOOK_LIMIT)}
            onOpenAll={() => onOpenCategory("reading-now")}
            onOpenBook={onOpenBook}
          />
          <CatalogSection
            category="club-proofread"
            id="catalog-section-club-proofread"
            books={clubProofreadBooks.slice(0, CATALOG_SECTION_BOOK_LIMIT)}
            onOpenAll={() => onOpenCategory("club-proofread")}
            onOpenBook={onOpenBook}
          />
        </div>
      )}
    </main>
  );
}
