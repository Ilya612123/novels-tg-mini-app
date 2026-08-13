import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ChapterDto } from "@novell-reader/shared";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
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
  const chapterPagerRef = useRef<HTMLElement>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [pageWidth, setPageWidth] = useState(0);
  const [pageStep, setPageStep] = useState(1);

  const progressPayload = useMemo(
    () => ({ bookId: chapter.bookId, chapterNumber: chapter.number, position: 0, percent: null }),
    [chapter.bookId, chapter.number]
  );

  const savePageProgress = useCallback(
    (nextPageIndex: number, nextPageCount: number) => {
      const percent = nextPageCount > 1 ? Math.min(100, Math.round((nextPageIndex / (nextPageCount - 1)) * 100)) : null;
      api
        .saveProgress({ bookId: chapter.bookId, chapterNumber: chapter.number, position: nextPageIndex, percent })
        .catch(console.error);
    },
    [chapter.bookId, chapter.number]
  );

  const measurePageWidth = useCallback(() => {
    const pager = chapterPagerRef.current;
    if (!pager) return;

    const nextPageWidth = Math.max(1, Math.round(pager.clientWidth));
    const columnGap = Number.parseFloat(window.getComputedStyle(pager).columnGap);
    setPageWidth(nextPageWidth);
    setPageStep(nextPageWidth + (Number.isFinite(columnGap) ? columnGap : 0));
  }, []);

  useLayoutEffect(() => {
    setPageIndex(0);
    measurePageWidth();
  }, [chapter.id, measurePageWidth]);

  useLayoutEffect(() => {
    const pager = chapterPagerRef.current;
    if (!pager || pageWidth <= 0 || pageStep <= 0) return;

    const pageGap = Math.max(0, pageStep - pageWidth);
    const nextPageCount = Math.max(1, Math.ceil((pager.scrollWidth + pageGap) / pageStep));
    setPageCount(nextPageCount);
    setPageIndex((currentPageIndex) => Math.min(currentPageIndex, nextPageCount - 1));
  }, [chapter.html, pageStep, pageWidth]);

  useEffect(() => {
    const scrollRoot = scrollRootRef.current;
    if (scrollRoot) scrollRoot.scrollTop = 0;
  }, [chapter.id, scrollRootRef]);

  useEffect(() => {
    window.addEventListener("resize", measurePageWidth);
    return () => window.removeEventListener("resize", measurePageWidth);
  }, [measurePageWidth]);

  useEffect(() => {
    api.saveProgress(progressPayload).catch(console.error);
    api.analytics(`начал читать Главу ${chapter.number}`, { bookId: chapter.bookId }).catch(console.error);
  }, [chapter.bookId, chapter.number, progressPayload]);

  const goToPreviousPage = () => {
    if (pageIndex > 0) {
      const nextPageIndex = pageIndex - 1;
      setPageIndex(nextPageIndex);
      savePageProgress(nextPageIndex, pageCount);
      return;
    }

    api.analytics("перешел на предыдущую главу", { bookId: chapter.bookId, chapterNumber: chapter.number }).catch(console.error);
    onNavigate(Math.max(1, chapter.number - 1));
  };

  const goToNextPage = () => {
    if (pageIndex < pageCount - 1) {
      const nextPageIndex = pageIndex + 1;
      setPageIndex(nextPageIndex);
      savePageProgress(nextPageIndex, pageCount);
      return;
    }

    api.analytics("перешел на следующую главу", { bookId: chapter.bookId, chapterNumber: chapter.number }).catch(console.error);
    onNavigate(chapter.number + 1);
  };

  const previousLabel = pageIndex > 0 ? "Предыдущая страница" : "Предыдущая глава";
  const nextLabel = pageIndex < pageCount - 1 ? "Следующая страница" : "Следующая глава";
  const chapterStyle = {
    "--reader-page-width": `${pageWidth || 1}px`,
    transform: `translateX(-${pageIndex * pageStep}px)`
  } as CSSProperties;

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
      <div className="chapter-viewport">
        <article
          className="chapter"
          data-testid="chapter-pager"
          dangerouslySetInnerHTML={{ __html: chapter.html }}
          ref={chapterPagerRef}
          style={chapterStyle}
        />
      </div>
      <div className="reader-actions">
        <button className="icon-button" onClick={goToPreviousPage} type="button" aria-label={previousLabel}>
          <ChevronLeft />
        </button>
        <span className="reader-page-count">{pageIndex + 1} / {pageCount}</span>
        <button className="icon-button" onClick={goToNextPage} type="button" aria-label={nextLabel}>
          <ChevronRight />
        </button>
      </div>
    </main>
  );
}
