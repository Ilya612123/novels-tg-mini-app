import { ChevronLeft } from "lucide-react";
import type { BookSummary } from "@novell-reader/shared";
import { BookCard } from "../components/BookCard";
import { getCatalogCategoryTitle, type CatalogCategory } from "./catalogCategories";

type CatalogCategoryScreenProps = {
  books: BookSummary[];
  category: CatalogCategory;
  onBack: () => void;
  onOpenBook: (bookId: string) => void;
};

export function CatalogCategoryScreen({ books, category, onBack, onOpenBook }: CatalogCategoryScreenProps) {
  return (
    <main className="screen">
      <header className="screen-header catalog-category-header">
        <button className="text-button catalog-category-back-button" onClick={onBack} type="button">
          <ChevronLeft aria-hidden="true" />
          Назад
        </button>
        <h1>{getCatalogCategoryTitle(category)}</h1>
      </header>
      <section className="book-grid">
        {books.map((book) => (
          <BookCard key={book.id} book={book} onOpen={onOpenBook} />
        ))}
      </section>
    </main>
  );
}
