import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { BookSummary } from "@novell-reader/shared";
import { BookCard } from "../components/BookCard";

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
      {filteredBooks.length > 0 ? (
        <section className="book-grid">
          {filteredBooks.map((book) => (
            <BookCard key={book.id} book={book} onOpen={onOpenBook} />
          ))}
        </section>
      ) : (
        <div className="state catalog-empty-search">Ничего не найдено</div>
      )}
    </main>
  );
}
