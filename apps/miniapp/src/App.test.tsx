import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

describe("App", () => {
  beforeEach(() => {
    vi.stubGlobal("scrollTo", vi.fn());
  });

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

  it("opens each page in a fresh scroll container without calling window scroll APIs", async () => {
    const scrollTo = vi.mocked(window.scrollTo);
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
                  progress: null
                }
              ]),
              { status: 200 }
            )
          );
        }
        if (url.endsWith("/api/books/book-1/chapters/1")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                id: "chapter-1",
                bookId: "book-1",
                number: 1,
                title: "Глава 1",
                html: "<p>Текст главы</p>",
                canRead: true
              }),
              { status: 200 }
            )
          );
        }
        if (url.endsWith("/api/books/book-1/chapters/2")) {
          return Promise.resolve(new Response(JSON.stringify({ canRead: false, reason: "paywall" }), { status: 402 }));
        }
        return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      })
    );

    render(<App />);

    fireEvent.click(await screen.findByText("Тестовая новелла"));
    fireEvent.click(await screen.findByText("Читать"));
    await screen.findByText("Глава 1");
    const readerScrollRoot = screen.getByTestId("page-scroll-root");
    readerScrollRoot.scrollTop = 420;
    scrollTo.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Следующая глава" }));

    await screen.findByText("Подписка");
    const paywallScrollRoot = screen.getByTestId("page-scroll-root");
    expect(paywallScrollRoot).not.toBe(readerScrollRoot);
    expect(paywallScrollRoot.scrollTop).toBe(0);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("hides the main bottom navigation while reading", async () => {
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
                  progress: null
                }
              ]),
              { status: 200 }
            )
          );
        }
        if (url.endsWith("/api/books/book-1/chapters/1")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                id: "chapter-1",
                bookId: "book-1",
                number: 1,
                title: "Глава 1",
                html: "<p>Текст главы</p>",
                canRead: true
              }),
              { status: 200 }
            )
          );
        }
        return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      })
    );

    render(<App />);

    expect(await screen.findByRole("navigation", { name: "Основная навигация" })).toBeTruthy();
    fireEvent.click(await screen.findByText("Тестовая новелла"));
    fireEvent.click(await screen.findByText("Читать"));

    await screen.findByText("Глава 1");
    expect(screen.queryByRole("navigation", { name: "Основная навигация" })).toBeNull();
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

  it("opens the support account from the profile", async () => {
    const openTelegramLink = vi.fn();
    vi.stubGlobal("Telegram", { WebApp: { openTelegramLink } });
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
    const supportButton = screen.getByRole("button", { name: "Поддержка" });
    expect(supportButton.className).toContain("profile-support-button");
    fireEvent.click(supportButton);

    expect(openTelegramLink).toHaveBeenCalledWith("https://t.me/esimsmile_support");
  });

  it("creates payment for the selected subscription plan", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith("/api/books")) {
        return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
      }
      if (url.endsWith("/api/payments/create")) {
        return Promise.resolve(new Response(JSON.stringify({ invoiceLink: "https://t.me/invoice", providerPayload: "payload" }), { status: 200 }));
      }
      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("Telegram", { WebApp: { openInvoice: vi.fn() } });

    render(<App />);

    fireEvent.click(await screen.findByText("Профиль"));
    fireEvent.click(await screen.findByText("Купить подписку"));
    fireEvent.click(screen.getByRole("radio", { name: /4 месяца/ }));
    fireEvent.click(screen.getByRole("button", { name: "Купить подписку · 819₽" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/payments/create",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ planId: "four-months" })
        })
      )
    );
  });

  it("shows paywall winback popups after closing the Telegram invoice", async () => {
    const openTelegramLink = vi.fn();
    const invoiceCallbacks: Array<(status: string) => void> = [];
    const openInvoice = vi.fn((_url: string, callback?: (status: string) => void) => {
      if (callback) invoiceCallbacks.push(callback);
    });
    const winbackResponses = [
      { offer: { id: "month-50-off", kind: "discount", title: "1 месяц со скидкой 50%", body: "Продолжите читать дешевле.", buttonLabel: "Купить за 149 Stars", planId: "month-50-off" } },
      { offer: { id: "month-75-off", kind: "discount", title: "1 месяц со скидкой 75%", body: "Последнее предложение.", buttonLabel: "Купить за 75 Stars", planId: "month-75-off" } },
      { offer: null }
    ];
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith("/api/books")) {
        return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
      }
      if (url.endsWith("/api/paywall/winback-offers/next")) {
        return Promise.resolve(new Response(JSON.stringify(winbackResponses.shift()), { status: 200 }));
      }
      if (url.endsWith("/api/payments/create")) {
        return Promise.resolve(new Response(JSON.stringify({ invoiceLink: "https://t.me/invoice", providerPayload: "payload" }), { status: 200 }));
      }
      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("Telegram", { WebApp: { openInvoice, openTelegramLink } });

    render(<App />);

    fireEvent.click(await screen.findByText("Профиль"));
    fireEvent.click(await screen.findByText("Купить подписку"));
    fireEvent.click(screen.getByRole("button", { name: "Купить подписку · 299₽" }));

    await waitFor(() => expect(openInvoice).toHaveBeenCalledWith("https://t.me/invoice", expect.any(Function)));
    invoiceCallbacks[0]?.("cancelled");
    expect(await screen.findByText("Не хватает Stars?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Купить Stars в PremiumBot" }));
    expect(openTelegramLink).toHaveBeenCalledWith("https://t.me/PremiumBot");

    fireEvent.click(screen.getByRole("button", { name: "Закрыть предложение" }));
    expect(await screen.findByText("1 месяц со скидкой 50%")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Купить за 149 Stars" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/payments/create",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ planId: "month-50-off" })
        })
      )
    );
    expect(openInvoice).toHaveBeenLastCalledWith("https://t.me/invoice", expect.any(Function));

    fireEvent.click(screen.getByRole("button", { name: "Закрыть предложение" }));
    expect(await screen.findByText("1 месяц со скидкой 75%")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Закрыть предложение" }));
    await waitFor(() => expect(screen.getByText("Здесь появятся книги, которые вы начали читать.")).toBeTruthy());

    fireEvent.click(screen.getByText("Купить подписку"));
    fireEvent.click(screen.getByRole("button", { name: "Купить подписку · 299₽" }));
    await waitFor(() => expect(openInvoice).toHaveBeenCalledTimes(3));
    invoiceCallbacks[2]?.("cancelled");
    expect(await screen.findByText("Не хватает Stars?")).toBeTruthy();
  });
});
