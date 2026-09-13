import type { BookSummary } from "@novell-reader/shared";
import { CatalogSection } from "../components/CatalogSection";
import { CATALOG_SECTION_BOOK_LIMIT, getCatalogCategoryBooks, sortByProgressUpdatedAtDesc } from "./catalogCategories";

const lowPriorityImageProps = { fetchpriority: "low" };

type BookmarksScreenProps = {
  books: BookSummary[];
  onContinue: (book: BookSummary) => void;
  onOpenBook: (bookId: string) => void;
  onOpenPopular: () => void;
};

export function BookmarksScreen({ books, onContinue, onOpenBook, onOpenPopular }: BookmarksScreenProps) {
  const started = sortByProgressUpdatedAtDesc(books.filter((book) => book.progress));
  const popularBooks = getCatalogCategoryBooks(books, "popular").slice(0, CATALOG_SECTION_BOOK_LIMIT);
  const openRandomBook = () => {
    if (books.length === 0) return;
    const randomIndex = Math.floor(Math.random() * books.length);
    onOpenBook(books[randomIndex].id);
  };

  return (
    <main className="screen">
      <header className="screen-header">
        <h1>Закладки</h1>
      </header>
      {started.length === 0 ? (
        <p className="muted bookmarks-empty-copy">Здесь появятся книги, которые вы начали читать. Пока можно выбрать что-нибудь из популярного.</p>
      ) : null}
      <div className="bookmarks-sections">
        {started.length > 0 ? (
          <section className="bookmarks-section" aria-labelledby="bookmarks-started-title">
            <h2 id="bookmarks-started-title">Продолжить чтение</h2>
            <div className="started-list">
              {started.map((book) => (
                <button className="started-row" key={book.id} onClick={() => onContinue(book)} type="button">
                  <span className="started-cover" aria-hidden="true">
                    {book.coverUrl ? (
                      <img src={book.coverUrl} alt="" decoding="async" loading="lazy" {...lowPriorityImageProps} />
                    ) : (
                      <span>{book.title.slice(0, 1)}</span>
                    )}
                  </span>
                  <span className="started-copy">
                    <span>{book.title}</span>
                    <small>Глава {book.progress?.chapterNumber}</small>
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : null}
        {books.length > 0 ? (
          <button className="primary-button bookmarks-random-button" onClick={openRandomBook} type="button">
            Случайная книга
          </button>
        ) : null}
        <CatalogSection
          books={popularBooks}
          category="popular"
          id="bookmarks-section-popular"
          onOpenAll={onOpenPopular}
          onOpenBook={onOpenBook}
        />
      </div>
    </main>
  );
}
