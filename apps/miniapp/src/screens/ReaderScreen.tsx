import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ChapterDto } from "@novell-reader/shared";
import { useEffect, useMemo } from "react";
import { api } from "../api/client";

export function ReaderScreen({
  chapter,
  bookTitle,
  onBack,
  onNavigate
}: {
  chapter: ChapterDto;
  bookTitle: string;
  onBack: () => void;
  onNavigate: (chapterNumber: number) => void;
}) {
  const progressPayload = useMemo(
    () => ({ bookId: chapter.bookId, chapterNumber: chapter.number, position: 0, percent: null }),
    [chapter.bookId, chapter.number]
  );

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [chapter.bookId, chapter.number]);

  useEffect(() => {
    api.saveProgress(progressPayload).catch(console.error);
    api.analytics(`начал читать Главу ${chapter.number}`, { bookId: chapter.bookId }).catch(console.error);
  }, [chapter.bookId, chapter.number, progressPayload]);

  useEffect(() => {
    let timer: number | undefined;
    const onScroll = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        const percent = maxScroll > 0 ? Math.min(100, Math.round((window.scrollY / maxScroll) * 100)) : null;
        api
          .saveProgress({ bookId: chapter.bookId, chapterNumber: chapter.number, position: Math.round(window.scrollY), percent })
          .catch(console.error);
      }, 1000);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(timer);
    };
  }, [chapter.bookId, chapter.number]);

  return (
    <main className="reader-screen">
      <button className="text-button" onClick={onBack} type="button">
        Назад
      </button>
      <p className="muted">{bookTitle}</p>
      <h1>{chapter.title}</h1>
      <article className="chapter" dangerouslySetInnerHTML={{ __html: chapter.html }} />
      <div className="reader-actions">
        <button
          className="icon-button"
          onClick={() => {
            api.analytics("перешел на предыдущую главу", { bookId: chapter.bookId, chapterNumber: chapter.number }).catch(console.error);
            onNavigate(Math.max(1, chapter.number - 1));
          }}
          type="button"
          aria-label="Предыдущая глава"
        >
          <ChevronLeft />
        </button>
        <button
          className="icon-button"
          onClick={() => {
            api.analytics("перешел на следующую главу", { bookId: chapter.bookId, chapterNumber: chapter.number }).catch(console.error);
            onNavigate(chapter.number + 1);
          }}
          type="button"
          aria-label="Следующая глава"
        >
          <ChevronRight />
        </button>
      </div>
    </main>
  );
}
