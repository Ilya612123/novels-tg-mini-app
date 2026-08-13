import type { BookSummary } from "@novell-reader/shared";

export function ProfileScreen({
  books,
  onContinue,
  onOpenPaywall
}: {
  books: BookSummary[];
  onContinue: (book: BookSummary) => void;
  onOpenPaywall: () => void;
}) {
  const started = books.filter((book) => book.progress);

  return (
    <main className="screen">
      <header className="screen-header">
        <h1>Профиль</h1>
      </header>
      <section className="profile-section">
        <h2>Начатые новеллы</h2>
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
      <section className="profile-section">
        <h2>Доступ</h2>
        <p className="muted">Статус доступа появится после подключения платежей.</p>
        <button className="primary-button profile-subscription-button" onClick={onOpenPaywall} type="button">
          Купить подписку
        </button>
      </section>
    </main>
  );
}
