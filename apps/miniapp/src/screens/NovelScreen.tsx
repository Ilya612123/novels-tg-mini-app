import { Star } from "lucide-react";
import type { BookSummary } from "@novell-reader/shared";

const highPriorityImageProps = { fetchpriority: "high" };
const lowPriorityImageProps = { fetchpriority: "low" };

function languageFromDescription(description: string | null): string | null {
  const match = description?.trim().match(/^Язык:\s*(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

function displayDescription(book: BookSummary, language: string | null): string {
  if (language && book.description?.trim().match(/^Язык:\s*.+$/i)) {
    return "Описание появится позже.";
  }
  return book.description ?? "Описание появится позже.";
}

function formatReviewCount(count: number): string {
  if (count >= 1000) {
    return `${Math.round(count / 100) / 10} K`;
  }
  return String(count);
}

export function NovelScreen({
  book,
  similarBooks = [],
  onBack,
  onRead,
  onOpenSimilar
}: {
  book: BookSummary;
  similarBooks?: BookSummary[];
  onBack: () => void;
  onRead: (chapterNumber: number) => void;
  onOpenSimilar?: (bookId: string) => void;
}) {
  const chapterNumber = book.progress?.chapterNumber ?? 1;
  const language = book.language ?? languageFromDescription(book.description);
  const metadata = [language ? `Язык: ${language}` : null, `${book.chapterCount} глав`].filter(Boolean).join(" · ");
  const tags = book.tags ?? [];

  return (
    <main className="screen detail-screen">
      <button className="text-button" onClick={onBack} type="button">
        Назад
      </button>
      <div className="detail-cover cover">
        {book.coverUrl ? (
          <img src={book.coverUrl} alt="" decoding="async" loading="eager" {...highPriorityImageProps} />
        ) : (
          <span>{book.title.slice(0, 1)}</span>
        )}
      </div>
      <h1>{book.title}</h1>
      <button className="primary-button" onClick={() => onRead(chapterNumber)} type="button">
        {book.progress ? "Продолжить" : "Читать"}
      </button>
      <p className="muted">{book.author ?? "Автор не указан"}</p>
      <p className="muted detail-meta">{metadata}</p>
      <p>{displayDescription(book, language)}</p>
      {tags.length > 0 ? (
        <div className="detail-tags" aria-label="Теги">
          {tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      ) : null}
      <section className="rating-section" aria-labelledby="rating-heading">
        <div className="rating-header">
          <h2 id="rating-heading">Оценки пользователей</h2>
          <div className="rating-summary" aria-label={`Средняя оценка ${book.rating.averageScore} из 10`}>
            <Star aria-hidden="true" size={22} fill="currentColor" />
            <strong>{book.rating.averageScore.toFixed(2)}</strong>
            <span>{formatReviewCount(book.rating.reviewCount)}</span>
          </div>
        </div>
        <div className="rating-bars">
          {book.rating.distribution.map((row) => (
            <div className="rating-row" key={row.score}>
              <span className="rating-score">{row.score}</span>
              <Star className="rating-row-star" aria-hidden="true" size={18} fill="currentColor" />
              <div className="rating-track" aria-hidden="true">
                <span style={{ width: `${row.percent}%` }} />
              </div>
              <strong>{row.percent}%</strong>
              <span className="rating-count">{row.count}</span>
            </div>
          ))}
        </div>
      </section>
      {similarBooks.length > 0 && onOpenSimilar ? (
        <section className="similar-section" aria-labelledby="similar-heading">
          <h2 id="similar-heading">Похожее</h2>
          <div className="similar-list">
            {similarBooks.map((item) => (
              <button className="similar-book-button" key={item.id} onClick={() => onOpenSimilar(item.id)} type="button">
                <span className="similar-book-cover cover">
                  {item.coverUrl ? (
                    <img src={item.coverUrl} alt="" decoding="async" loading="lazy" {...lowPriorityImageProps} />
                  ) : (
                    <span>{item.title.slice(0, 1)}</span>
                  )}
                </span>
                <span className="similar-book-copy">
                  <strong>{item.title}</strong>
                  <small>{item.author ?? "Автор не указан"}</small>
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
