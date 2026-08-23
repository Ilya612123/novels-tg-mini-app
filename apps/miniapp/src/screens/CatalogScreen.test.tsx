import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
    progress: null,
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
    rating: { averageScore: 8.8, reviewCount: 80, distribution: [] },
    progress: null,
    tags: ["экшен"]
  }
];

describe("CatalogScreen", () => {
  afterEach(() => cleanup());

  it("filters catalog books locally by the search query", () => {
    render(<CatalogScreen books={books} onOpenBook={vi.fn()} onSearch={vi.fn()} />);

    fireEvent.change(screen.getByRole("searchbox", { name: "Поиск по книгам" }), { target: { value: "уров" } });

    expect(screen.getByText("Поднятие уровня в одиночку")).toBeTruthy();
    expect(screen.queryByText("Башня Бога")).toBeNull();
  });

  it("shows an empty local result state without removing the search field", () => {
    render(<CatalogScreen books={books} onOpenBook={vi.fn()} onSearch={vi.fn()} />);

    fireEvent.change(screen.getByRole("searchbox", { name: "Поиск по книгам" }), { target: { value: "нет такой книги" } });

    expect(screen.getByText("Ничего не найдено")).toBeTruthy();
    expect(screen.getByRole("searchbox", { name: "Поиск по книгам" })).toBeTruthy();
  });
});
