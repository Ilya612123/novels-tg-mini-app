import type { BookSummary } from "@novell-reader/shared";

export function NovelScreen({
  book,
  onBack,
  onRead
}: {
  book: BookSummary;
  onBack: () => void;
  onRead: (chapterNumber: number) => void;
}) {
  const chapterNumber = book.progress?.chapterNumber ?? 1;

  return (
    <main className="screen detail-screen">
      <button className="text-button" onClick={onBack} type="button">
        Назад
      </button>
      <div className="detail-cover cover">{book.coverUrl ? <img src={book.coverUrl} alt="" /> : <span>{book.title.slice(0, 1)}</span>}</div>
      <h1>{book.title}</h1>
      <p className="muted">{book.author ?? "Автор не указан"}</p>
      <p>{book.description ?? "Описание появится позже."}</p>
      <p className="muted">{book.chapterCount} глав, бесплатно {book.freeChapterLimit}</p>
      <button className="primary-button" onClick={() => onRead(chapterNumber)} type="button">
        {book.progress ? "Продолжить" : "Читать"}
      </button>
    </main>
  );
}
