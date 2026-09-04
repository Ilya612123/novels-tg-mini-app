import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { BookSummary } from "@novell-reader/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CatalogCategoryScreen } from "./CatalogCategoryScreen";

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

describe("CatalogCategoryScreen", () => {
  afterEach(() => cleanup());

  it("renders a separate category page with back navigation", () => {
    const onBack = vi.fn();
    const onOpenBook = vi.fn();
    render(<CatalogCategoryScreen books={books} category="popular" onBack={onBack} onOpenBook={onOpenBook} />);

    expect(screen.getByRole("heading", { level: 1, name: "Популярное сейчас" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Назад" }).closest(".catalog-category-header")).toBeTruthy();
    expect(screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual([
      "Башня Бога",
      "Поднятие уровня в одиночку"
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Назад" }));
    fireEvent.click(screen.getByRole("button", { name: /Башня Бога/ }));

    expect(onBack).toHaveBeenCalledOnce();
    expect(onOpenBook).toHaveBeenCalledWith("book-1");
  });
});
