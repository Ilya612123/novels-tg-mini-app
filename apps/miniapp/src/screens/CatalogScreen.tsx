import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { BookSummary } from "@novell-reader/shared";
import { BookCard } from "../components/BookCard";

const SEARCH_ANALYTICS_DELAY_MS = 500;
const CATALOG_SECTION_BOOK_LIMIT = 10;

function normalizeSearchQuery(query: string): string {
  return query.trim().toLocaleLowerCase("ru-RU");
}

function matchesSearchQuery(book: BookSummary, query: string): boolean {
  const searchableText = [book.title, book.author, ...(book.tags ?? [])].filter(Boolean).join(" ").toLocaleLowerCase("ru-RU");
  return searchableText.includes(query);
}

function sortByProgressUpdatedAtDesc(books: BookSummary[]): BookSummary[] {
  return [...books].sort((first, second) => {
    const firstUpdatedAt = first.progress ? Date.parse(first.progress.updatedAt) : 0;
    const secondUpdatedAt = second.progress ? Date.parse(second.progress.updatedAt) : 0;
    return secondUpdatedAt - firstUpdatedAt;
  });
}

function sortByPopularityDesc(books: BookSummary[]): BookSummary[] {
  return [...books].sort((first, second) => {
    const reviewCountDiff = second.rating.reviewCount - first.rating.reviewCount;
    if (reviewCountDiff !== 0) return reviewCountDiff;
    return second.rating.averageScore - first.rating.averageScore;
  });
}

function CatalogSection({
  books,
  id,
  title,
  onOpenBook
}: {
  books: BookSummary[];
  id: string;
  title: string;
  onOpenBook: (bookId: string) => void;
}) {
  if (books.length === 0) return null;

  return (
    <section className="catalog-section" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      <div className="catalog-book-rail">
        {books.map((book) => (
          <BookCard key={book.id} book={book} onOpen={onOpenBook} />
        ))}
      </div>
    </section>
  );
}

type CatalogScreenProps = {
  books: BookSummary[];
  onOpenBook: (bookId: string) => void;
  onSearch?: (query: string, resultCount: number) => void;
};

export function CatalogScreen({ books, onOpenBook, onSearch }: CatalogScreenProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const normalizedSearchQuery = normalizeSearchQuery(searchQuery);
  const filteredBooks = useMemo(() => {
    if (!normalizedSearchQuery) return books;
    return books.filter((book) => matchesSearchQuery(book, normalizedSearchQuery));
  }, [books, normalizedSearchQuery]);
  const continueReadingBooks = useMemo(
    () => sortByProgressUpdatedAtDesc(books.filter((book) => book.progress)).slice(0, CATALOG_SECTION_BOOK_LIMIT),
    [books]
  );
  const popularBooks = useMemo(() => sortByPopularityDesc(books).slice(0, CATALOG_SECTION_BOOK_LIMIT), [books]);
  const newBooks = useMemo(() => books.slice(0, CATALOG_SECTION_BOOK_LIMIT), [books]);

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
          type="search"
          value={searchQuery}
        />
      </label>
      {normalizedSearchQuery && filteredBooks.length > 0 ? (
        <section className="book-grid">
          {filteredBooks.map((book) => (
            <BookCard key={book.id} book={book} onOpen={onOpenBook} />
          ))}
        </section>
      ) : normalizedSearchQuery ? (
        <div className="state catalog-empty-search">Ничего не найдено</div>
      ) : (
        <div className="catalog-sections">
          <CatalogSection
            id="catalog-section-continue-reading"
            title="Продолжить чтение"
            books={continueReadingBooks}
            onOpenBook={onOpenBook}
          />
          <CatalogSection id="catalog-section-popular" title="Популярное сейчас" books={popularBooks} onOpenBook={onOpenBook} />
          <CatalogSection id="catalog-section-new" title="Свежие новинки" books={newBooks} onOpenBook={onOpenBook} />
        </div>
      )}
    </main>
  );
}
