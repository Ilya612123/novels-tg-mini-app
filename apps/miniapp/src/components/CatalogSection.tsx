import { ArrowUpRight } from "lucide-react";
import type { BookSummary } from "@novell-reader/shared";
import { BookCard } from "./BookCard";
import { getCatalogCategoryTitle, type CatalogCategory } from "../screens/catalogCategories";

export function CatalogSection({
  books,
  category,
  id,
  onOpenAll,
  onOpenBook
}: {
  books: BookSummary[];
  category: CatalogCategory;
  id: string;
  onOpenAll: () => void;
  onOpenBook: (bookId: string) => void;
}) {
  if (books.length === 0) return null;
  const title = getCatalogCategoryTitle(category);

  return (
    <section className="catalog-section" aria-labelledby={id}>
      <div className="catalog-section-header">
        <h2 id={id}>{title}</h2>
        <button className="text-button catalog-section-all-button" onClick={onOpenAll} type="button">
          <ArrowUpRight aria-hidden="true" />
          Все
        </button>
      </div>
      <div className="catalog-book-rail">
        {books.map((book) => (
          <BookCard key={book.id} book={book} onOpen={onOpenBook} />
        ))}
      </div>
    </section>
  );
}
