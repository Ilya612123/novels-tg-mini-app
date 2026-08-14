import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import type { BookSummary, ChapterDto, PaywallWinbackOffer } from "@novell-reader/shared";
import { ApiError, api } from "./api/client";
import type { Tab } from "./components/BottomNav";
import { ErrorState } from "./components/ErrorState";
import { LoadingState } from "./components/LoadingState";
import { openInvoice, openTelegramLink } from "./telegram";

const BottomNav = lazy(() => import("./components/BottomNav").then((module) => ({ default: module.BottomNav })));
const CatalogScreen = lazy(() => import("./screens/CatalogScreen").then((module) => ({ default: module.CatalogScreen })));
const NovelScreen = lazy(() => import("./screens/NovelScreen").then((module) => ({ default: module.NovelScreen })));
const PaywallScreen = lazy(() => import("./screens/PaywallScreen").then((module) => ({ default: module.PaywallScreen })));
const ProfileScreen = lazy(() => import("./screens/ProfileScreen").then((module) => ({ default: module.ProfileScreen })));
const ReaderScreen = lazy(() => import("./screens/ReaderScreen").then((module) => ({ default: module.ReaderScreen })));
const PaywallWinbackModal = lazy(() =>
  import("./components/PaywallWinbackModal").then((module) => ({ default: module.PaywallWinbackModal }))
);

type View =
  | { name: "catalog" }
  | { name: "profile" }
  | { name: "novel"; bookId: string }
  | { name: "reader"; bookId: string; chapter: ChapterDto }
  | { name: "paywall"; bookId: string | null; chapterNumber: number | null; returnTo: "novel" | "profile" };

type AppError = {
  status: number | null;
  message: string;
};

const supportUrl = "https://t.me/esimsmile_support";

function toAppError(err: unknown, fallbackMessage: string): AppError {
  if (err instanceof ApiError) return { status: err.status, message: err.message };
  return { status: null, message: err instanceof Error ? err.message : fallbackMessage };
}

function pickSimilarBooks(books: BookSummary[], currentBookId: string): BookSummary[] {
  const candidates = books.filter((book) => book.id !== currentBookId);
  if (candidates.length <= 3) return candidates;

  const offset = Array.from(currentBookId).reduce((sum, char) => sum + char.charCodeAt(0), 0) % candidates.length;
  return candidates.slice(offset).concat(candidates.slice(0, offset)).slice(0, 3);
}

function getViewKey(view: View): string {
  if (view.name === "novel") return `novel:${view.bookId}`;
  if (view.name === "reader") return `reader:${view.bookId}:${view.chapter.number}`;
  if (view.name === "paywall") return `paywall:${view.bookId ?? "profile"}:${view.chapterNumber ?? "subscription"}:${view.returnTo}`;
  return view.name;
}

export function App() {
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [view, setView] = useState<View>({ name: "catalog" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);
  const [winbackOffer, setWinbackOffer] = useState<PaywallWinbackOffer | null>(null);
  const pageScrollRootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.analytics("открыл Mini App").catch(console.error);
    api
      .books()
      .then((items) => {
        setBooks(items);
        api.analytics("открыл Каталог").catch(console.error);
      })
      .catch((err: unknown) => setError(toAppError(err, "Не удалось загрузить книги")))
      .finally(() => setLoading(false));
  }, []);

  const currentBook = useMemo(() => {
    if (view.name === "novel" || view.name === "reader" || (view.name === "paywall" && view.bookId)) {
      return books.find((book) => book.id === view.bookId) ?? null;
    }
    return null;
  }, [books, view]);

  const similarBooks = useMemo(() => (currentBook ? pickSimilarBooks(books, currentBook.id) : []), [books, currentBook]);

  const openBook = (bookId: string) => {
    setView({ name: "novel", bookId });
    const book = books.find((item) => item.id === bookId);
    api.analytics(`открыл ${book?.title ?? "карточку новеллы"}`, { bookId }).catch(console.error);
  };

  const openChapter = async (bookId: string, chapterNumber: number) => {
    setLoading(true);
    setError(null);
    try {
      const chapter = await api.chapter(bookId, chapterNumber);
      if (!chapter.canRead) {
        api.analytics("уперся в paywall", { bookId, chapterNumber }).catch(console.error);
        setView({ name: "paywall", bookId, chapterNumber, returnTo: "novel" });
        return;
      }
      setView({ name: "reader", bookId, chapter });
    } catch (err) {
      setError(toAppError(err, "Не удалось открыть главу"));
    } finally {
      setLoading(false);
    }
  };

  const activeTab: Tab = view.name === "profile" || (view.name === "paywall" && view.returnTo === "profile") ? "profile" : "catalog";
  const isTelegramAuthError = error?.status === 401;
  const viewKey = getViewKey(view);

  const leavePaywall = () => {
    if (view.name !== "paywall") return;
    if (view.returnTo === "profile" || !view.bookId) {
      setView({ name: "profile" });
      return;
    }
    setView({ name: "novel", bookId: view.bookId });
  };

  const showNextWinbackOfferOrLeave = () => {
    if (view.name !== "paywall") return;
    api
      .nextPaywallWinbackOffer()
      .then(({ offer }) => {
        if (offer) {
          setWinbackOffer(offer);
          return;
        }
        setWinbackOffer(null);
        leavePaywall();
      })
      .catch(() => {
        setWinbackOffer(null);
        leavePaywall();
      });
  };

  const showNextWinbackOfferAfterInvoice = (status: string) => {
    if (status === "paid") return;
    import("@novell-reader/shared")
      .then((module) => setWinbackOffer(module.starsHelpWinbackOffer))
      .catch((err) => setError(toAppError(err, "Не удалось показать предложение")));
  };

  const handleWinbackAction = () => {
    if (!winbackOffer) return;
    if (winbackOffer.kind === "premium-bot") {
      openTelegramLink("https://t.me/PremiumBot");
      return;
    }
    api
      .createPayment(winbackOffer.planId)
      .then((payment) => openInvoice(payment.invoiceLink, showNextWinbackOfferAfterInvoice))
      .catch((err) => setError(toAppError(err, "Не удалось открыть оплату")));
  };

  if (loading && books.length === 0) return <LoadingState />;
  if (isTelegramAuthError) {
    return (
      <ErrorState
        title="Откройте приложение через Telegram"
        message="Так мы сможем определить ваш профиль и сохранить прогресс чтения."
      />
    );
  }
  if (error) return <ErrorState message={error.message} />;

  const pageScrollClassName = view.name === "reader" ? "app-page-scroll app-page-scroll-reader" : "app-page-scroll";

  return (
    <div className="app-shell">
      <div className={pageScrollClassName} data-testid="page-scroll-root" key={viewKey} ref={pageScrollRootRef}>
        <Suspense fallback={<LoadingState />}>
          {view.name === "catalog" && <CatalogScreen books={books} onOpenBook={openBook} />}
          {view.name === "profile" && (
            <ProfileScreen
              books={books}
              onContinue={(book) => {
                api.analytics("продолжил чтение из профиля", { bookId: book.id }).catch(console.error);
                void openChapter(book.id, book.progress?.chapterNumber ?? 1);
              }}
              onOpenPaywall={() => {
                api.analytics("открыл paywall из профиля").catch(console.error);
                setView({ name: "paywall", bookId: null, chapterNumber: null, returnTo: "profile" });
              }}
              onOpenSupport={() => {
                api.analytics("открыл поддержку из профиля").catch(console.error);
                openTelegramLink(supportUrl);
              }}
            />
          )}
          {view.name === "novel" && currentBook && (
            <NovelScreen
              book={currentBook}
              similarBooks={similarBooks}
              onBack={() => setView({ name: "catalog" })}
              onRead={(chapterNumber) => void openChapter(currentBook.id, chapterNumber)}
              onOpenSimilar={openBook}
            />
          )}
          {view.name === "reader" && currentBook && (
            <ReaderScreen
              chapter={view.chapter}
              bookTitle={currentBook.title}
              scrollRootRef={pageScrollRootRef}
              onBack={() => setView({ name: "novel", bookId: currentBook.id })}
              onNavigate={(chapterNumber) => void openChapter(currentBook.id, chapterNumber)}
            />
          )}
          {view.name === "paywall" && (
            <PaywallScreen
              onBack={leavePaywall}
              onBuy={(planId) => {
                api.analytics("нажал кнопку оплаты", { bookId: view.bookId, chapterNumber: view.chapterNumber, planId }).catch(console.error);
                api
                  .createPayment(planId)
                  .then((payment) => openInvoice(payment.invoiceLink, showNextWinbackOfferAfterInvoice))
                  .catch((err) => setError(toAppError(err, "Не удалось открыть оплату")));
              }}
            />
          )}
        </Suspense>
      </div>
      {winbackOffer && (
        <Suspense fallback={null}>
          <PaywallWinbackModal offer={winbackOffer} onAction={handleWinbackAction} onClose={showNextWinbackOfferOrLeave} />
        </Suspense>
      )}
      {view.name !== "reader" && (
        <BottomNav
          activeTab={activeTab}
          onChange={(tab) => {
            setView(tab === "profile" ? { name: "profile" } : { name: "catalog" });
            if (tab === "profile") api.analytics("открыл Профиль").catch(console.error);
            if (tab === "catalog") api.analytics("открыл Каталог").catch(console.error);
          }}
        />
      )}
    </div>
  );
}
