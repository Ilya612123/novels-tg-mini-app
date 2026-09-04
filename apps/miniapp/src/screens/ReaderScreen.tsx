import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ChapterDto } from "@novell-reader/shared";
import { useEffect, useMemo, type RefObject } from "react";
import { api } from "../api/client";

export function ReaderScreen({
  chapter,
  bookTitle,
  scrollRootRef,
  onBack,
  onNavigate
}: {
  chapter: ChapterDto;
  bookTitle: string;
  scrollRootRef: RefObject<HTMLElement | null>;
  onBack: () => void;
  onNavigate: (chapterNumber: number) => void;
}) {
  const progressPayload = useMemo(
    () => ({ bookId: chapter.bookId, chapterNumber: chapter.number, position: 0, percent: null }),
    [chapter.bookId, chapter.number]
  );

  useEffect(() => {
    const scrollRoot = scrollRootRef.current;
    if (scrollRoot) scrollRoot.scrollTop = 0;
  }, [chapter.id, scrollRootRef]);

  useEffect(() => {
    api.saveProgress(progressPayload).catch(console.error);
    api.analytics(`начал читать Главу ${chapter.number}`, { bookTitle }).catch(console.error);
  }, [bookTitle, chapter.number, progressPayload]);

  const goToPreviousChapter = () => {
    api.analytics("перешел на предыдущую главу", { bookTitle, chapterNumber: chapter.number }).catch(console.error);
    onNavigate(Math.max(1, chapter.number - 1));
  };

  const goToNextChapter = () => {
    api.analytics("перешел на следующую главу", { bookTitle, chapterNumber: chapter.number }).catch(console.error);
    onNavigate(chapter.number + 1);
  };

  return (
    <main className="reader-screen">
      <header className="reader-header">
        <button className="text-button" onClick={onBack} type="button">
          Назад
        </button>
        <div className="reader-title-block">
          <p className="muted">{bookTitle}</p>
          <h1>{chapter.title}</h1>
        </div>
      </header>
      <article className="chapter" data-testid="chapter-content" dangerouslySetInnerHTML={{ __html: chapter.html }} />
      <div className="reader-actions">
        <button className="icon-button" onClick={goToPreviousChapter} type="button" aria-label="Предыдущая глава">
          <ChevronLeft />
        </button>
        <span className="reader-page-count">Глава {chapter.number}</span>
        <button className="icon-button" onClick={goToNextChapter} type="button" aria-label="Следующая глава">
          <ChevronRight />
        </button>
      </div>
    </main>
  );
}
