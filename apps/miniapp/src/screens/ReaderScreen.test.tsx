import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChapterDto } from "@novell-reader/shared";
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
  });

  it("scrolls to the top when the opened chapter changes", () => {
    const scrollTo = vi.fn();
    vi.stubGlobal("scrollTo", scrollTo);
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 })))
    );

    const { rerender } = render(
      <ReaderScreen chapter={chapter} bookTitle="Новелла" onBack={vi.fn()} onNavigate={vi.fn()} />
    );

    rerender(
      <ReaderScreen
        chapter={{ ...chapter, id: "chapter-2", number: 2, title: "Глава 2" }}
        bookTitle="Новелла"
        onBack={vi.fn()}
        onNavigate={vi.fn()}
      />
    );

    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, left: 0 });
  });
});
