import type { BookSummary } from "@novell-reader/shared";
import { BookCard } from "../components/BookCard";

export function CatalogScreen({ books, onOpenBook }: { books: BookSummary[]; onOpenBook: (bookId: string) => void }) {
  if (books.length === 0) {
    return <div className="state">Книги пока не импортированы</div>;
  }

  return (
    <main className="screen">
      <header className="screen-header">
        <h1>Книги</h1>
      </header>
      <section className="book-grid">
        {books.map((book) => (
          <BookCard key={book.id} book={book} onOpen={onOpenBook} />
        ))}
      </section>
    </main>
  );
}
