import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ChapterDto } from "@novell-reader/shared";
import { useEffect, useMemo, type RefObject } from "react";
import { api } from "../api/client";

export function ReaderScreen({
  chapter,
  chapterNumber,
  bookTitle,
  scrollRootRef,
  onBack,
  onNavigate
}: {
  chapter: ChapterDto | null;
  chapterNumber: number;
  bookTitle: string;
  scrollRootRef: RefObject<HTMLElement | null>;
  onBack: () => void;
  onNavigate: (chapterNumber: number) => void;
}) {
  const progressPayload = useMemo(
    () => (chapter ? { bookId: chapter.bookId, chapterNumber: chapter.number, position: 0, percent: null } : null),
    [chapter]
  );

  useEffect(() => {
    const scrollRoot = scrollRootRef.current;
    if (scrollRoot) scrollRoot.scrollTop = 0;
  }, [chapter?.id, chapterNumber, scrollRootRef]);

  useEffect(() => {
    if (!chapter || !progressPayload) return;
    api.saveProgress(progressPayload).catch(console.error);
    api.analytics(`начал читать Главу ${chapter.number}`, { bookTitle }).catch(console.error);
  }, [bookTitle, chapter, progressPayload]);

  const goToPreviousChapter = () => {
    api.analytics("перешел на предыдущую главу", { bookTitle, chapterNumber }).catch(console.error);
    onNavigate(Math.max(1, chapterNumber - 1));
  };

  const goToNextChapter = () => {
    api.analytics("перешел на следующую главу", { bookTitle, chapterNumber }).catch(console.error);
    onNavigate(chapterNumber + 1);
  };

  return (
    <main className="reader-screen">
      <header className="reader-header">
        <button className="text-button" onClick={onBack} type="button">
          Назад
        </button>
        <div className="reader-title-block">
          <p className="muted">{bookTitle}</p>
          {chapter ? <h1>{chapter.title}</h1> : <div className="reader-title-skeleton" data-testid="reader-title-skeleton" />}
        </div>
      </header>
      {chapter ? (
        <article className="chapter" data-testid="chapter-content" dangerouslySetInnerHTML={{ __html: chapter.html }} />
      ) : (
        <article className="chapter reader-chapter-skeleton" data-testid="reader-chapter-skeleton" aria-label="Глава загружается">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </article>
      )}
      <div className="reader-actions">
        <button className="icon-button" onClick={goToPreviousChapter} type="button" aria-label="Предыдущая глава">
          <ChevronLeft />
        </button>
        <span className="reader-page-count">Глава {chapterNumber}</span>
        <button className="icon-button" onClick={goToNextChapter} type="button" aria-label="Следующая глава">
          <ChevronRight />
        </button>
      </div>
    </main>
  );
}
