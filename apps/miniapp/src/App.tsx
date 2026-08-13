import { useEffect, useMemo, useState } from "react";
import { starsHelpWinbackOffer, type BookSummary, type ChapterDto } from "@novell-reader/shared";
import type { PaywallWinbackOffer } from "@novell-reader/shared";
import { ApiError, api } from "./api/client";
import { BottomNav, type Tab } from "./components/BottomNav";
import { ErrorState } from "./components/ErrorState";
import { LoadingState } from "./components/LoadingState";
import { PaywallWinbackModal } from "./components/PaywallWinbackModal";
import { CatalogScreen } from "./screens/CatalogScreen";
import { NovelScreen } from "./screens/NovelScreen";
import { PaywallScreen } from "./screens/PaywallScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { ReaderScreen } from "./screens/ReaderScreen";
import { openInvoice, openTelegramLink } from "./telegram";

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

export function App() {
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [view, setView] = useState<View>({ name: "catalog" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);
  const [winbackOffer, setWinbackOffer] = useState<PaywallWinbackOffer | null>(null);

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
    setWinbackOffer(starsHelpWinbackOffer);
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

  return (
    <div className="app-shell">
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
        <NovelScreen book={currentBook} onBack={() => setView({ name: "catalog" })} onRead={(chapterNumber) => void openChapter(currentBook.id, chapterNumber)} />
      )}
      {view.name === "reader" && currentBook && (
        <ReaderScreen
          chapter={view.chapter}
          bookTitle={currentBook.title}
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
      {winbackOffer && <PaywallWinbackModal offer={winbackOffer} onAction={handleWinbackAction} onClose={showNextWinbackOfferOrLeave} />}
      <BottomNav
        activeTab={activeTab}
        onChange={(tab) => {
          setView(tab === "profile" ? { name: "profile" } : { name: "catalog" });
          if (tab === "profile") api.analytics("открыл Профиль").catch(console.error);
          if (tab === "catalog") api.analytics("открыл Каталог").catch(console.error);
        }}
      />
    </div>
  );
}
