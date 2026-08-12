import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

describe("App", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders catalog navigation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.endsWith("/api/books")) {
          return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
        }
        return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      })
    );

    render(<App />);

    await waitFor(() => expect(screen.getByText("Книги")).toBeTruthy());
    expect(screen.getByText("Профиль")).toBeTruthy();
  });

  it("shows a readable Telegram launch error when auth data is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.endsWith("/api/books")) {
          return Promise.resolve(
            new Response(JSON.stringify({ error: "Не удалось определить пользователя Telegram" }), { status: 401 })
          );
        }
        return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      })
    );

    render(<App />);

    await waitFor(() => expect(screen.getByText("Откройте приложение через Telegram")).toBeTruthy());
    expect(screen.getByText("Так мы сможем определить ваш профиль и сохранить прогресс чтения.")).toBeTruthy();
  });

  it("opens the paywall when continuing to a locked chapter", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.endsWith("/api/books")) {
          return Promise.resolve(
            new Response(
              JSON.stringify([
                {
                  id: "book-1",
                  title: "Тестовая новелла",
                  author: "Автор",
                  description: "Описание",
                  coverUrl: null,
                  chapterCount: 10,
                  freeChapterLimit: 3,
                  progress: {
                    bookId: "book-1",
                    chapterNumber: 4,
                    percent: null,
                    updatedAt: "2026-08-12T00:00:00.000Z"
                  }
                }
              ]),
              { status: 200 }
            )
          );
        }
        if (url.endsWith("/api/books/book-1/chapters/4")) {
          return Promise.resolve(new Response(JSON.stringify({ canRead: false, reason: "paywall" }), { status: 402 }));
        }
        return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      })
    );

    render(<App />);

    fireEvent.click(await screen.findByText("Тестовая новелла"));
    fireEvent.click(await screen.findByText("Продолжить"));

    await waitFor(() => expect(screen.getByText("Продолжение по доступу")).toBeTruthy());
  });
});
