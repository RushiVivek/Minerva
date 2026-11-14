import Link from "next/link";
import { notFound } from "next/navigation";

import { listCatalogBooks } from "@/lib/catalog";
import { Reader } from "./reader";

export default async function ReadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const book = (await listCatalogBooks({ includePrivate: false, limit: 100 })).find(
    (item) => item.id === id,
  );
  if (!book) notFound();

  return (
    <main className="reader-page">
      <header className="reader-header">
        <Link href={`/books/${book.id}`}>← {book.title}</Link>
        <span className="muted">{book.authors.join(", ") || "Unknown author"}</span>
      </header>
      <Reader bookId={book.id} title={book.title} />
    </main>
  );
}
