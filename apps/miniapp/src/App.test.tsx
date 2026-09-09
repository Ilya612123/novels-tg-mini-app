import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

async function clickFirstBookCard(title: string) {
  const cards = await screen.findAllByRole("button", { name: new RegExp(title) });
  fireEvent.click(cards[0]);
}

describe("App", () => {
  beforeEach(() => {
    vi.stubGlobal("scrollTo", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
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
    expect(screen.getByText("Закладки")).toBeTruthy();
    expect(screen.getByText("Профиль")).toBeTruthy();
  });

  it("opens catalog categories as separate app views", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.endsWith("/api/books")) {
          return Promise.resolve(
            new Response(
              JSON.stringify([
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
                  rating: { averageScore: 8.8, reviewCount: 120, distribution: [] },
                  progress: null,
                  tags: ["экшен"]
                }
              ]),
              { status: 200 }
            )
          );
        }
        return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      })
    );

    render(<App />);

    const popularSection = await screen.findByRole("region", { name: "Популярное сейчас" });
    fireEvent.click(within(popularSection).getByRole("button", { name: "Все" }));

    await waitFor(() => expect(screen.getByRole("heading", { level: 1, name: "Популярное сейчас" })).toBeTruthy());
    expect(screen.getByRole("button", { name: "Назад" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Назад" }));

    await waitFor(() => expect(screen.getByRole("heading", { level: 1, name: "Книги" })).toBeTruthy());
  });

  it("logs catalog loading start and rendered events", async () => {
    const fetchMock = vi.fn((url: string, _options?: RequestInit) => {
      if (url.endsWith("/api/books")) {
        return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
      }
      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/analytics",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ label: "загрузка Каталога началась" })
        })
      )
    );
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/analytics",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ label: "Каталог отрендерился", metadata: { bookCount: 0 } })
        })
      )
    );
  });

  it("batches catalog scroll events into one directional analytics event", async () => {
    const fetchMock = vi.fn((url: string, _options?: RequestInit) => {
      if (url.endsWith("/api/books")) {
        return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
      }
      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    const pageScrollRoot = await screen.findByTestId("page-scroll-root");
    fireEvent.wheel(pageScrollRoot);
    pageScrollRoot.scrollTop = 10;
    fireEvent.scroll(pageScrollRoot);
    pageScrollRoot.scrollTop = 54;
    fireEvent.scroll(pageScrollRoot);
    pageScrollRoot.scrollTop = 97;
    fireEvent.scroll(pageScrollRoot);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/analytics",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ label: "скролл Каталога вниз", metadata: { startScrollTop: 10, endScrollTop: 97 } })
        })
      )
    );
    expect(
      fetchMock.mock.calls.filter(
        ([url, options]) =>
          String(url).endsWith("/api/analytics") &&
          typeof options === "object" &&
          options !== null &&
          "body" in options &&
          typeof options.body === "string" &&
          options.body.includes("скролл Каталога")
      )
    ).toHaveLength(1);
  });

  it("does not log catalog scroll events from search-driven layout changes", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith("/api/books")) {
        return Promise.resolve(
          new Response(
            JSON.stringify([
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
              }
            ]),
            { status: 200 }
          )
        );
      }
      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    fireEvent.change(await screen.findByRole("searchbox", { name: "Поиск по книгам" }), { target: { value: "баш" } });
    const pageScrollRoot = screen.getByTestId("page-scroll-root");
    pageScrollRoot.scrollTop = 80;
    fireEvent.scroll(pageScrollRoot);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/analytics",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ label: "искал в Каталоге", metadata: { query: "баш", resultCount: 1 } })
        })
      )
    );
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/analytics",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("скролл Каталога")
      })
    );
  });

  it("logs catalog search queries with the local result count", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith("/api/books")) {
        return Promise.resolve(
          new Response(
            JSON.stringify([
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
            ]),
            { status: 200 }
          )
        );
      }
      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    fireEvent.change(await screen.findByRole("searchbox", { name: "Поиск по книгам" }), { target: { value: "  уров  " } });

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/analytics",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ label: "искал в Каталоге", metadata: { query: "уров", resultCount: 1 } })
        })
      )
    );
  });

  it("logs Mini App activity while the app stays open", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith("/api/books")) {
        return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
      }
      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/analytics",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ label: "активен в Mini App", metadata: { elapsedSec: 10 } })
      })
    );
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

    await clickFirstBookCard("Тестовая новелла");
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

    await clickFirstBookCard("Тестовая новелла");
    fireEvent.click(await screen.findByText("Читать"));
    await screen.findByRole("heading", { level: 1, name: "Глава 1" });
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
    await clickFirstBookCard("Тестовая новелла");
    fireEvent.click(await screen.findByText("Читать"));

    await screen.findByRole("heading", { level: 1, name: "Глава 1" });
    expect(screen.queryByRole("navigation", { name: "Основная навигация" })).toBeNull();
  });

  it("opens saved reading progress from the bookmarks tab", async () => {
    const fetchMock = vi.fn((url: string) => {
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
                  distribution: []
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
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: "chapter-4",
              bookId: "book-1",
              number: 4,
              title: "Глава 4",
              html: "<p>Текст главы</p>",
              canRead: true
            }),
            { status: 200 }
          )
        );
      }
      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    fireEvent.click(await screen.findByText("Закладки"));
    expect(await screen.findByRole("heading", { level: 1, name: "Закладки" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Тестовая новелла/ }));

    expect(await screen.findByText("Глава 4")).toBeTruthy();
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/analytics",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ label: "продолжил чтение из закладок", metadata: { bookTitle: "Тестовая новелла" } })
        })
      )
    );
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
    expect(await screen.findByText("Подписка открывает продолжение без ограничений.")).toBeTruthy();
    expect(screen.getByText("Все платные главы во всех новеллах")).toBeTruthy();
    expect(screen.getByText("Доступ на 30 дней сразу после оплаты")).toBeTruthy();
    expect(screen.getByText("Чтение без ожидания новых бесплатных глав")).toBeTruthy();

    fireEvent.click(await screen.findByText("Купить подписку"));

    expect(await screen.findByText("Подписка")).toBeTruthy();
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
        if (url.endsWith("/api/config")) {
          return Promise.resolve(new Response(JSON.stringify({ supportUrl: "https://t.me/custom_support" }), { status: 200 }));
        }
        if (url.endsWith("/api/books")) {
          return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
        }
        return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      })
    );

    render(<App />);

    fireEvent.click(await screen.findByText("Профиль"));
    const supportButton = await screen.findByRole("button", { name: "Поддержка" });
    expect(supportButton.className).toContain("profile-support-button");
    fireEvent.click(supportButton);

    expect(openTelegramLink).toHaveBeenCalledWith("https://t.me/custom_support");
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

  it("offers a 50% discount when leaving the paywall without paying", async () => {
    const winbackResponses = [
      { offer: { id: "month-50-off", kind: "discount", title: "1 месяц со скидкой 50%", body: "Продолжите читать дешевле.", buttonLabel: "Купить за 149₽", planId: "month-50-off" } },
      { offer: null }
    ];
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith("/api/books")) {
        return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
      }
      if (url.endsWith("/api/paywall/winback-offers/next")) {
        return Promise.resolve(new Response(JSON.stringify(winbackResponses.shift()), { status: 200 }));
      }
      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    fireEvent.click(await screen.findByText("Профиль"));
    fireEvent.click(await screen.findByText("Купить подписку"));
    fireEvent.click(await screen.findByRole("button", { name: "Назад" }));

    expect(await screen.findByText("1 месяц со скидкой 50%")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Закрыть предложение" }));
    await waitFor(() => expect(screen.getByText("Подписка открывает продолжение без ограничений.")).toBeTruthy());
  });

  it("shows paywall winback popups after closing the Telegram invoice", async () => {
    const openTelegramLink = vi.fn();
    const invoiceCallbacks: Array<(status: string) => void> = [];
    const openInvoice = vi.fn((_url: string, callback?: (status: string) => void) => {
      if (callback) invoiceCallbacks.push(callback);
    });
    const winbackResponses = [
      { offer: { id: "month-50-off", kind: "discount", title: "1 месяц со скидкой 50%", body: "Продолжите читать дешевле.", buttonLabel: "Купить за 149₽", planId: "month-50-off" } },
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
    fireEvent.click(screen.getByRole("button", { name: "Купить за 149₽" }));

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
    await waitFor(() => expect(screen.getByText("Подписка открывает продолжение без ограничений.")).toBeTruthy());

    fireEvent.click(screen.getByText("Купить подписку"));
    fireEvent.click(screen.getByRole("button", { name: "Купить подписку · 299₽" }));
    await waitFor(() => expect(openInvoice).toHaveBeenCalledTimes(3));
    invoiceCallbacks[2]?.("cancelled");
    expect(await screen.findByText("Не хватает Stars?")).toBeTruthy();
  });

  it("confirms paid invoices and shows active subscription in profile", async () => {
    const invoiceCallbacks: Array<(status: string) => void> = [];
    const openInvoice = vi.fn((_url: string, callback?: (status: string) => void) => {
      if (callback) invoiceCallbacks.push(callback);
    });
    let accessChecks = 0;
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith("/api/books")) {
        return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
      }
      if (url.endsWith("/api/access")) {
        accessChecks += 1;
        return Promise.resolve(
          new Response(
            JSON.stringify(
              accessChecks === 1
                ? { active: false, subscriptionUntil: null }
                : { active: true, subscriptionUntil: "2026-10-10T09:00:00.000Z" }
            ),
            { status: 200 }
          )
        );
      }
      if (url.endsWith("/api/payments/create")) {
        return Promise.resolve(new Response(JSON.stringify({ invoiceLink: "https://t.me/invoice", providerPayload: "payload" }), { status: 200 }));
      }
      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("Telegram", { WebApp: { openInvoice } });

    render(<App />);

    fireEvent.click(await screen.findByText("Профиль"));
    fireEvent.click(await screen.findByText("Купить подписку"));
    fireEvent.click(screen.getByRole("button", { name: "Купить подписку · 299₽" }));

    await waitFor(() => expect(openInvoice).toHaveBeenCalledWith("https://t.me/invoice", expect.any(Function)));
    invoiceCallbacks[0]?.("paid");

    expect(await screen.findByText("Оплата прошла. Активируем подписку...")).toBeTruthy();
    expect(await screen.findByText(/Подписка активна до 10 октября 2026/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Купить подписку" })).toBeNull();
  });

  it("shows an issued discount offer when the paywall is opened again", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith("/api/books")) {
        return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
      }
      if (url.endsWith("/api/paywall/plans")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              plans: [
                {
                  id: "month",
                  title: "Месяц",
                  priceLabel: "299₽",
                  starsAmount: 167,
                  durationDays: 30,
                  period: "1 месяц",
                  oldPrice: null,
                  discount: null,
                  badge: null,
                  invoiceTitle: "Доступ к новеллам на 30 дней",
                  invoiceDescription: "Откройте продолжение всех новелл на 30 дней.",
                  invoiceLabel: "30 дней доступа",
                  paywallVisible: true
                },
                {
                  id: "month-50-off",
                  title: "Месяц -50%",
                  priceLabel: "149₽",
                  starsAmount: 83,
                  durationDays: 30,
                  period: "1 месяц",
                  oldPrice: "299₽",
                  discount: "Скидка 50%",
                  badge: null,
                  invoiceTitle: "Доступ к новеллам на 30 дней со скидкой 50%",
                  invoiceDescription: "Откройте продолжение всех новелл на 30 дней со скидкой 50%.",
                  invoiceLabel: "30 дней доступа со скидкой 50%",
                  paywallVisible: false
                }
              ]
            }),
            { status: 200 }
          )
        );
      }
      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    fireEvent.click(await screen.findByText("Профиль"));
    fireEvent.click(screen.getByText("Купить подписку"));

    expect(await screen.findByRole("radio", { name: /Месяц -50%/ })).toBeTruthy();
    expect(screen.getByText("149₽")).toBeTruthy();
  });
});
