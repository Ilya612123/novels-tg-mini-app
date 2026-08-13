import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NovelScreen } from "./NovelScreen";
import type { BookSummary } from "@novell-reader/shared";

const book: BookSummary = {
  id: "book-1",
  title: "Тестовая новелла",
  author: "Автор",
  description: "Описание",
  coverUrl: null,
  chapterCount: 10,
  freeChapterLimit: 3,
  rating: {
    averageScore: 9.72,
    reviewCount: 7200,
    distribution: [
      { score: 10, count: 6602, percent: 91.7 },
      { score: 9, count: 158, percent: 2.2 },
      { score: 8, count: 151, percent: 2.1 },
      { score: 7, count: 72, percent: 1 },
      { score: 6, count: 72, percent: 1 },
      { score: 5, count: 29, percent: 0.4 },
      { score: 4, count: 29, percent: 0.4 },
      { score: 3, count: 14, percent: 0.2 },
      { score: 2, count: 7, percent: 0.1 },
      { score: 1, count: 65, percent: 0.9 }
    ]
  },
  progress: null
};

describe("NovelScreen", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows the total chapter count without the free chapter count", () => {
    render(<NovelScreen book={book} onBack={vi.fn()} onRead={vi.fn()} />);

    expect(screen.getByText("10 глав")).toBeTruthy();
    expect(screen.queryByText(/бесплатно 3/)).toBeNull();
    expect(screen.getByRole("button", { name: "Читать" })).toBeTruthy();
  });

  it("places the read button before author, metadata, description, and tags", () => {
    render(
      <NovelScreen
        book={{
          ...book,
          description: "Описание",
          language: "ru",
          tags: ["романтика", "драма"]
        }}
        onBack={vi.fn()}
        onRead={vi.fn()}
      />
    );

    const content = document.querySelector(".detail-screen")?.textContent ?? "";

    expect(content.indexOf("Тестовая новелла")).toBeLessThan(content.indexOf("Читать"));
    expect(content.indexOf("Читать")).toBeLessThan(content.indexOf("Автор"));
    expect(content.indexOf("Автор")).toBeLessThan(content.indexOf("Язык: ru · 10 глав"));
    expect(content.indexOf("Язык: ru · 10 глав")).toBeLessThan(content.indexOf("Описание"));
    expect(content.indexOf("Описание")).toBeLessThan(content.indexOf("романтика"));
    expect(screen.getByText("драма")).toBeTruthy();
  });

  it("uses language-only descriptions as metadata instead of book description", () => {
    render(<NovelScreen book={{ ...book, description: "Язык: ru" }} onBack={vi.fn()} onRead={vi.fn()} />);

    expect(screen.getByText("Язык: ru · 10 глав")).toBeTruthy();
    expect(screen.getByText("Описание появится позже.")).toBeTruthy();
    expect(screen.queryByText("Язык: ru", { selector: "p:not(.detail-meta)" })).toBeNull();
  });

  it("shows static user rating details", () => {
    render(<NovelScreen book={book} onBack={vi.fn()} onRead={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Оценки пользователей" })).toBeTruthy();
    expect(screen.getByText("9.72")).toBeTruthy();
    expect(screen.getByText("7.2 K")).toBeTruthy();
    expect(screen.getByText("91.7%")).toBeTruthy();
    expect(screen.getByText("6602")).toBeTruthy();
  });
});
