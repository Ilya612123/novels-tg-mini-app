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
                  rating: {
                    averageScore: 9.14,
                    reviewCount: 2400,
                    distribution: [
                      { score: 10, count: 600, percent: 25 },
                      { score: 9, count: 1608, percent: 67 },
                      { score: 8, count: 96, percent: 4 },
                      { score: 7, count: 24, percent: 1 },
                      { score: 6, count: 24, percent: 1 },
                      { score: 5, count: 12, percent: 0.5 },
                      { score: 4, count: 12, percent: 0.5 },
                      { score: 3, count: 12, percent: 0.5 },
                      { score: 2, count: 6, percent: 0.3 },
                      { score: 1, count: 6, percent: 0.3 }
                    ]
                  },
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

    await waitFor(() => expect(screen.getByText("Подписка")).toBeTruthy());
    expect(screen.queryByText("Читайте продолжение без ограничений и открывайте платные главы сразу после оплаты.")).toBeNull();
    expect(screen.getByRole("radiogroup", { name: "Тарифы подписки" })).toBeTruthy();
    expect((screen.getByRole("radio", { name: /Месяц/ }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByRole("button", { name: "Купить подписку · 299₽" })).toBeTruthy();
  });

  it("opens the subscription paywall from the profile", async () => {
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

    fireEvent.click(await screen.findByText("Профиль"));
    fireEvent.click(await screen.findByText("Купить подписку"));

    expect(screen.getByText("Подписка")).toBeTruthy();
    expect(screen.queryByText("Читайте продолжение без ограничений и открывайте платные главы сразу после оплаты.")).toBeNull();
    expect((screen.getByRole("radio", { name: /Месяц/ }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole("radio", { name: /4 месяца/ }));
    expect((screen.getByRole("radio", { name: /4 месяца/ }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByRole("button", { name: "Купить подписку · 819₽" })).toBeTruthy();
    expect(screen.getAllByText("299₽").length).toBeGreaterThan(0);
    expect(screen.getAllByText("819₽").length).toBeGreaterThan(0);
    expect(screen.getByText("1499₽")).toBeTruthy();
    expect(screen.getByText("2999₽")).toBeTruthy();
    expect(screen.getAllByText(/Скидка/).length).toBeGreaterThan(0);
  });
});
