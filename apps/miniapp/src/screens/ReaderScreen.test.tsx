import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
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

function mockColumnGap(value: string) {
  const style = document.createElement("div").style;
  style.columnGap = value;
  vi.spyOn(window, "getComputedStyle").mockReturnValue(style);
}

describe("ReaderScreen", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("saves reading progress when paging through the chapter", () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);
    mockColumnGap("16px");
    const onNavigate = vi.fn();

    const scrollRootRef = createRef<HTMLDivElement>();
    render(
      <div ref={scrollRootRef}>
        <ReaderScreen chapter={chapter} bookTitle="Новелла" scrollRootRef={scrollRootRef} onBack={vi.fn()} onNavigate={onNavigate} />
      </div>
    );

    const chapterPager = screen.getByTestId("chapter-pager");
    Object.defineProperty(chapterPager, "clientWidth", { configurable: true, value: 320 });
    Object.defineProperty(chapterPager, "scrollWidth", { configurable: true, value: 992 });
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    fireEvent.click(screen.getByRole("button", { name: "Следующая страница" }));
    vi.advanceTimersByTime(1000);

    expect(onNavigate).not.toHaveBeenCalled();
    expect(chapterPager.getAttribute("style")).toContain("translateX(-336px)");
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/progress",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ bookId: "book-1", chapterNumber: 1, position: 1, percent: 50 })
      })
    );
  });

  it("groups the book and chapter title into a compact header title block", () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);

    const scrollRootRef = createRef<HTMLDivElement>();
    render(
      <div ref={scrollRootRef}>
        <ReaderScreen chapter={chapter} bookTitle="Новелла" scrollRootRef={scrollRootRef} onBack={vi.fn()} onNavigate={vi.fn()} />
      </div>
    );

    expect(screen.getByRole("heading", { name: "Глава 1" }).closest(".reader-title-block")).not.toBeNull();
  });

  it("moves to the next chapter from the final page", () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);
    mockColumnGap("16px");
    const onNavigate = vi.fn();

    const scrollRootRef = createRef<HTMLDivElement>();
    render(
      <div ref={scrollRootRef}>
        <ReaderScreen chapter={chapter} bookTitle="Новелла" scrollRootRef={scrollRootRef} onBack={vi.fn()} onNavigate={onNavigate} />
      </div>
    );

    const chapterPager = screen.getByTestId("chapter-pager");
    Object.defineProperty(chapterPager, "clientWidth", { configurable: true, value: 320 });
    Object.defineProperty(chapterPager, "scrollWidth", { configurable: true, value: 656 });
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    fireEvent.click(screen.getByRole("button", { name: "Следующая страница" }));
    fireEvent.click(screen.getByRole("button", { name: "Следующая глава" }));

    expect(onNavigate).toHaveBeenCalledWith(2);
  });
});
