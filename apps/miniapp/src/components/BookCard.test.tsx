import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BookSummary } from "@novell-reader/shared";
import { BookCard } from "./BookCard";

const book: BookSummary = {
  id: "book-1",
  title: "Точка зрения Всеведущего читателя",
  author: "Автор",
  description: "Описание",
  coverUrl: null,
  chapterCount: 551,
  freeChapterLimit: 10,
  rating: {
    averageScore: 9.72,
    reviewCount: 1200,
    distribution: []
  },
  progress: null
};

describe("BookCard", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows the average rating badge on the cover preview", () => {
    render(<BookCard book={book} onOpen={vi.fn()} />);

    expect(screen.getByLabelText("Средняя оценка 9.7 из 10").textContent).toBe("9.7");
  });
});
