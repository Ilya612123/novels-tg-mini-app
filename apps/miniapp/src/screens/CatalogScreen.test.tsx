import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { BookSummary } from "@novell-reader/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CatalogScreen } from "./CatalogScreen";

const books: BookSummary[] = [
  {
    id: "book-1",
    title: "Башня Бога",
    author: "SIU",
    description: "Фэнтези",
    coverUrl: null,
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

describe("CatalogScreen", () => {
  afterEach(() => cleanup());

  it("shows the catalog home sections without a search query", () => {
    render(<CatalogScreen books={books} onOpenBook={vi.fn()} onSearch={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Продолжить чтение" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Популярное сейчас" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Свежие новинки" })).toBeTruthy();

    const continueSection = screen.getByRole("region", { name: "Продолжить чтение" });
    expect(within(continueSection).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual([
      "Поднятие уровня в одиночку",
      "Башня Бога"
    ]);
  });

  it("filters catalog books locally by the search query", () => {
    render(<CatalogScreen books={books} onOpenBook={vi.fn()} onSearch={vi.fn()} />);

    fireEvent.change(screen.getByRole("searchbox", { name: "Поиск по книгам" }), { target: { value: "уров" } });

    expect(screen.getByText("Поднятие уровня в одиночку")).toBeTruthy();
    expect(screen.queryByText("Башня Бога")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Популярное сейчас" })).toBeNull();
  });

  it("shows an empty local result state without removing the search field", () => {
    render(<CatalogScreen books={books} onOpenBook={vi.fn()} onSearch={vi.fn()} />);

    fireEvent.change(screen.getByRole("searchbox", { name: "Поиск по книгам" }), { target: { value: "нет такой книги" } });

    expect(screen.getByText("Ничего не найдено")).toBeTruthy();
    expect(screen.getByRole("searchbox", { name: "Поиск по книгам" })).toBeTruthy();
  });
});
