import { useEffect, useMemo, useState } from "react";
import type { BookSummary, ChapterDto } from "@novell-reader/shared";
import { api } from "./api/client";
import { BottomNav, type Tab } from "./components/BottomNav";
import { ErrorState } from "./components/ErrorState";
import { LoadingState } from "./components/LoadingState";
import { CatalogScreen } from "./screens/CatalogScreen";
import { NovelScreen } from "./screens/NovelScreen";
import { PaywallScreen } from "./screens/PaywallScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { ReaderScreen } from "./screens/ReaderScreen";
import { openInvoice } from "./telegram";

type View =
  | { name: "catalog" }
  | { name: "profile" }
  | { name: "novel"; bookId: string }
  | { name: "reader"; bookId: string; chapter: ChapterDto }
  | { name: "paywall"; bookId: string; chapterNumber: number };

export function App() {
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [view, setView] = useState<View>({ name: "catalog" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.analytics("открыл Mini App").catch(console.error);
    api
      .books()
      .then((items) => {
        setBooks(items);
        api.analytics("открыл Каталог").catch(console.error);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Не удалось загрузить книги"))
      .finally(() => setLoading(false));
  }, []);

  const currentBook = useMemo(() => {
    if (view.name === "novel" || view.name === "reader" || view.name === "paywall") {
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
        setView({ name: "paywall", bookId, chapterNumber });
        return;
      }
      setView({ name: "reader", bookId, chapter });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось открыть главу");
    } finally {
      setLoading(false);
    }
  };

  const activeTab: Tab = view.name === "profile" ? "profile" : "catalog";

  if (loading && books.length === 0) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

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
          onBack={() => setView({ name: "novel", bookId: view.bookId })}
          onBuy={() => {
            api.analytics("нажал кнопку оплаты", { bookId: view.bookId, chapterNumber: view.chapterNumber }).catch(console.error);
            api.createPayment().then((payment) => openInvoice(payment.invoiceLink)).catch((err) => setError(err instanceof Error ? err.message : "Не удалось открыть оплату"));
          }}
        />
      )}
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
