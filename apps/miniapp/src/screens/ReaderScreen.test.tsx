import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChapterDto } from "@novell-reader/shared";
import { createRef } from "react";
import { ReaderScreen } from "./ReaderScreen";

const chapter: ChapterDto = {
  id: "chapter-1",
  bookId: "book-1",
  number: 1,
  title: "Глава 1",
  html: "<p>Текст главы</p>",
  canRead: true
};

describe("ReaderScreen", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("renders the full chapter and saves reading progress when opening it", () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);
    const onNavigate = vi.fn();

    const scrollRootRef = createRef<HTMLDivElement>();
    render(
      <div ref={scrollRootRef}>
        <ReaderScreen chapter={chapter} chapterNumber={chapter.number} bookTitle="Новелла" scrollRootRef={scrollRootRef} onBack={vi.fn()} onNavigate={onNavigate} />
      </div>
    );

    expect(screen.getByTestId("chapter-content").innerHTML).toBe("<p>Текст главы</p>");
    expect(onNavigate).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/progress",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ bookId: "book-1", chapterNumber: 1, position: 0, percent: null })
      })
    );
  });

  it("groups the book and chapter title into a compact header title block", () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);

    const scrollRootRef = createRef<HTMLDivElement>();
    render(
      <div ref={scrollRootRef}>
        <ReaderScreen chapter={chapter} chapterNumber={chapter.number} bookTitle="Новелла" scrollRootRef={scrollRootRef} onBack={vi.fn()} onNavigate={vi.fn()} />
      </div>
    );

    expect(screen.getByRole("heading", { name: "Глава 1" }).closest(".reader-title-block")).not.toBeNull();
  });

  it("logs reading analytics with the readable book title", () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);

    const scrollRootRef = createRef<HTMLDivElement>();
    render(
      <div ref={scrollRootRef}>
        <ReaderScreen chapter={chapter} chapterNumber={chapter.number} bookTitle="Башня Бога" scrollRootRef={scrollRootRef} onBack={vi.fn()} onNavigate={vi.fn()} />
      </div>
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/analytics",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ label: "начал читать Главу 1", metadata: { bookTitle: "Башня Бога" } })
      })
    );
  });

  it("moves to the next chapter from the bottom chapter actions", () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);
    const onNavigate = vi.fn();

    const scrollRootRef = createRef<HTMLDivElement>();
    render(
      <div ref={scrollRootRef}>
        <ReaderScreen chapter={chapter} chapterNumber={chapter.number} bookTitle="Новелла" scrollRootRef={scrollRootRef} onBack={vi.fn()} onNavigate={onNavigate} />
      </div>
    );

    fireEvent.click(screen.getByRole("button", { name: "Следующая глава" }));

    expect(onNavigate).toHaveBeenCalledWith(2, "next");
  });

  it("logs chapter navigation analytics with the readable book title", () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);
    const onNavigate = vi.fn();

    const scrollRootRef = createRef<HTMLDivElement>();
    render(
      <div ref={scrollRootRef}>
        <ReaderScreen chapter={chapter} chapterNumber={chapter.number} bookTitle="Башня Бога" scrollRootRef={scrollRootRef} onBack={vi.fn()} onNavigate={onNavigate} />
      </div>
    );

    fireEvent.click(screen.getByRole("button", { name: "Следующая глава" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/analytics",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ label: "начал читать Главу 1", metadata: { bookTitle: "Башня Бога" } })
      })
    );
  });

  it("logs reading progress every 10 percent while scrolling", () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);

    const scrollRootRef = createRef<HTMLDivElement>();
    render(
      <div ref={scrollRootRef}>
        <ReaderScreen chapter={chapter} chapterNumber={chapter.number} bookTitle="Башня Бога" scrollRootRef={scrollRootRef} onBack={vi.fn()} onNavigate={vi.fn()} />
      </div>
    );

    Object.defineProperty(scrollRootRef.current, "scrollHeight", { configurable: true, value: 1000 });
    Object.defineProperty(scrollRootRef.current, "clientHeight", { configurable: true, value: 100 });
    scrollRootRef.current!.scrollTop = 190;
    fireEvent.scroll(scrollRootRef.current!);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/analytics",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ label: "читает главу 1", metadata: { bookTitle: "Башня Бога", chapterNumber: 1, percent: 10 } })
      })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/analytics",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ label: "читает главу 1", metadata: { bookTitle: "Башня Бога", chapterNumber: 1, percent: 20 } })
      })
    );
  });

  it("logs when leaving the reader with the back button", () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);
    const onBack = vi.fn();

    const scrollRootRef = createRef<HTMLDivElement>();
    render(
      <div ref={scrollRootRef}>
        <ReaderScreen chapter={chapter} chapterNumber={chapter.number} bookTitle="Башня Бога" scrollRootRef={scrollRootRef} onBack={onBack} onNavigate={vi.fn()} />
      </div>
    );

    fireEvent.click(screen.getByRole("button", { name: "Назад" }));

    expect(onBack).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/analytics",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ label: "вышел из чтения главы", metadata: { bookTitle: "Башня Бога", chapterNumber: 1 } })
      })
    );
  });
});
