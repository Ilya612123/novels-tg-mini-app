import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ChapterDto } from "@novell-reader/shared";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import { api } from "../api/client";

type ReadingProgressUpdate = {
  bookId: string;
  chapterNumber: number;
  position: number;
  percent: number | null;
};

export function ReaderScreen({
  chapter,
  chapterNumber,
  bookTitle,
  scrollRootRef,
  onBack,
  onProgressSaved,
  onNavigate
}: {
  chapter: ChapterDto | null;
  chapterNumber: number;
  bookTitle: string;
  scrollRootRef: RefObject<HTMLElement | null>;
  onBack: () => void;
  onProgressSaved: (progress: ReadingProgressUpdate) => void;
  onNavigate: (chapterNumber: number, direction: "previous" | "next") => void;
}) {
  const reportedReadingPercentsRef = useRef<Set<number>>(new Set());
  const progressPayload = useMemo(
    () => (chapter ? { bookId: chapter.bookId, chapterNumber: chapter.number, position: 0, percent: null } : null),
    [chapter]
  );

  useEffect(() => {
    const scrollRoot = scrollRootRef.current;
    if (scrollRoot) scrollRoot.scrollTop = 0;
    reportedReadingPercentsRef.current = new Set();
  }, [chapter?.id, chapterNumber, scrollRootRef]);

  useEffect(() => {
    if (!chapter || !progressPayload) return;
    api
      .saveProgress(progressPayload)
      .then(() => onProgressSaved(progressPayload))
      .catch(console.error);
    api.analytics(`начал читать Главу ${chapter.number}`, { bookTitle }).catch(console.error);
  }, [bookTitle, chapter, onProgressSaved, progressPayload]);

  useEffect(() => {
    if (!chapter) return;
    const scrollRoot = scrollRootRef.current;
    if (!scrollRoot) return;

    const handleScroll = () => {
      const scrollableHeight = scrollRoot.scrollHeight - scrollRoot.clientHeight;
      if (scrollableHeight <= 0) return;

      const currentPercent = Math.min(100, Math.max(0, (scrollRoot.scrollTop / scrollableHeight) * 100));
      const crossedPercent = Math.floor(currentPercent / 10) * 10;

      for (let percent = 10; percent <= crossedPercent; percent += 10) {
        if (reportedReadingPercentsRef.current.has(percent)) continue;
        reportedReadingPercentsRef.current.add(percent);
        const payload = { bookId: chapter.bookId, chapterNumber: chapter.number, position: Math.round(scrollRoot.scrollTop), percent };
        api
          .saveProgress(payload)
          .then(() => onProgressSaved(payload))
          .catch(console.error);
        api.analytics(`читает главу ${chapter.number}`, { bookTitle, chapterNumber: chapter.number, percent }).catch(console.error);
      }
    };

    scrollRoot.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => scrollRoot.removeEventListener("scroll", handleScroll);
  }, [bookTitle, chapter, onProgressSaved, scrollRootRef]);

  const goToPreviousChapter = () => {
    onNavigate(Math.max(1, chapterNumber - 1), "previous");
  };

  const goToNextChapter = () => {
    onNavigate(chapterNumber + 1, "next");
  };

  const leaveReader = () => {
    api.analytics("вышел из чтения главы", { bookTitle, chapterNumber }).catch(console.error);
    onBack();
  };

  return (
    <main className="reader-screen">
      <header className="reader-header">
        <button className="text-button" onClick={leaveReader} type="button">
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
