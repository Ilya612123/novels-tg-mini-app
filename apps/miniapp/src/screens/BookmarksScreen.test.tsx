import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { BookSummary } from "@novell-reader/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BookmarksScreen } from "./BookmarksScreen";

const books: BookSummary[] = [
  {
    id: "book-1",
    title: "Башня Бога",
    author: "SIU",
    description: "Фэнтези",
    coverUrl: "https://example.com/tower.jpg",
    chapterCount: 10,
    freeChapterLimit: 3,
    rating: { averageScore: 9.1, reviewCount: 100, distribution: [] },
    progress: {
      bookId: "book-1",
      chapterNumber: 2,
      percent: 35,
      updatedAt: "2026-09-02T12:00:00.000Z"
    },
    tags: ["фэнтези"]
  },
  {
    id: "book-2",
    title: "Поднятие уровня в одиночку",
    author: "Chugong",
    description: "Экшен",
    coverUrl: null,
    chapterCount: 12,
    freeChapterLimit: 3,
    rating: { averageScore: 8.8, reviewCount: 120, distribution: [] },
    progress: {
      bookId: "book-2",
      chapterNumber: 4,
      percent: 60,
      updatedAt: "2026-09-03T12:00:00.000Z"
    },
    tags: ["экшен"]
  },
  {
    id: "book-3",
    title: "Новый роман",
    author: "Автор",
    description: "Романтика",
    coverUrl: null,
    chapterCount: 8,
    freeChapterLimit: 3,
    rating: { averageScore: 9.4, reviewCount: 90, distribution: [] },
    progress: null,
    tags: ["романтика"]
  }
];

describe("BookmarksScreen", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows started books with cover previews above popular books", () => {
    const onContinue = vi.fn();

    render(<BookmarksScreen books={books} onContinue={onContinue} onOpenBook={vi.fn()} onOpenPopular={vi.fn()} />);

    expect(screen.getByRole("heading", { level: 1, name: "Закладки" })).toBeTruthy();
    const startedSection = screen.getByRole("region", { name: "Продолжить чтение" });
    const startedButtons = within(startedSection).getAllByRole("button");
    expect(startedButtons.map((button) => button.querySelector(".started-copy")?.textContent)).toEqual([
      "Поднятие уровня в одиночкуГлава 4",
      "Башня БогаГлава 2"
    ]);
    expect(startedButtons[1].querySelector("img")?.getAttribute("src")).toBe("https://example.com/tower.jpg");
    expect(screen.getByRole("region", { name: "Популярное сейчас" })).toBeTruthy();

    fireEvent.click(startedButtons[0]);
    expect(onContinue).toHaveBeenCalledWith(books[1]);
  });

  it("keeps popular books visible when there is no reading progress", () => {
    const onOpenBook = vi.fn();
    const onOpenPopular = vi.fn();

    render(
      <BookmarksScreen
        books={books.map((book) => ({ ...book, progress: null }))}
        onContinue={vi.fn()}
        onOpenBook={onOpenBook}
        onOpenPopular={onOpenPopular}
      />
    );

    expect(screen.queryByRole("region", { name: "Продолжить чтение" })).toBeNull();
    expect(screen.getByText("Здесь появятся книги, которые вы начали читать. Пока можно выбрать что-нибудь из популярного.")).toBeTruthy();
    const popularSection = screen.getByRole("region", { name: "Популярное сейчас" });
    expect(within(popularSection).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual([
      "Поднятие уровня в одиночку",
      "Башня Бога",
      "Новый роман"
    ]);

    fireEvent.click(within(popularSection).getByRole("button", { name: "Все" }));
    expect(onOpenPopular).toHaveBeenCalledOnce();
    fireEvent.click(within(popularSection).getByRole("button", { name: "Поднятие уровня в одиночку" }));
    expect(onOpenBook).toHaveBeenCalledWith("book-2");
  });

  it("opens a random book before the popular section", () => {
    const onOpenBook = vi.fn();
    vi.spyOn(Math, "random").mockReturnValue(0.7);

    render(<BookmarksScreen books={books} onContinue={vi.fn()} onOpenBook={onOpenBook} onOpenPopular={vi.fn()} />);

    const allButtons = screen.getAllByRole("button");
    const randomButtonIndex = allButtons.findIndex((button) => button.textContent === "Случайная книга");
    const popularButtonIndex = allButtons.findIndex((button) => button.textContent === "Все");
    expect(randomButtonIndex).toBeGreaterThan(-1);
    expect(randomButtonIndex).toBeLessThan(popularButtonIndex);

    fireEvent.click(screen.getByRole("button", { name: "Случайная книга" }));
    expect(onOpenBook).toHaveBeenCalledWith("book-3");
  });
});
