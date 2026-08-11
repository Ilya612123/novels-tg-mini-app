import type { BookSummary } from "@novell-reader/shared";

export function BookCard({ book, onOpen }: { book: BookSummary; onOpen: (bookId: string) => void }) {
  const progressText = book.progress ? `Глава ${book.progress.chapterNumber}` : `${book.chapterCount} глав`;

  return (
    <button className="book-card" onClick={() => onOpen(book.id)} type="button">
      <div className="cover">
        {book.coverUrl ? <img src={book.coverUrl} alt="" /> : <span>{book.title.slice(0, 1)}</span>}
      </div>
      <div className="book-card-text">
        <h3>{book.title}</h3>
        <p>{progressText}</p>
      </div>
    </button>
  );
}
