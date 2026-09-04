import type { BookSummary } from "@novell-reader/shared";

export function BookmarksScreen({ books, onContinue }: { books: BookSummary[]; onContinue: (book: BookSummary) => void }) {
  const started = books.filter((book) => book.progress);

  return (
    <main className="screen">
      <header className="screen-header">
        <h1>Закладки</h1>
      </header>
      <section className="profile-section">
        {started.length === 0 ? (
          <p className="muted">Здесь появятся книги, которые вы начали читать.</p>
        ) : (
          started.map((book) => (
            <button className="started-row" key={book.id} onClick={() => onContinue(book)} type="button">
              <span>{book.title}</span>
              <small>Глава {book.progress?.chapterNumber}</small>
            </button>
          ))
        )}
      </section>
    </main>
  );
}
