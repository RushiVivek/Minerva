import Link from "next/link";
import { notFound } from "next/navigation";

import { LibraryShell } from "@/components/LibraryShell";
import { listCatalogBooks } from "@/lib/catalog";

export default async function BookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const book = (await listCatalogBooks({ includePrivate: false, limit: 100 })).find(
    (item) => item.id === id,
  );
  if (!book) notFound();

  return (
    <LibraryShell>
      <div className="book-detail">
        <div className="book-detail-cover cover"><span>{book.title}</span></div>
        <div className="book-detail-content">
          <div className="eyebrow">Book details</div>
          <h1>{book.title}</h1>
          <p className="book-author">{book.authors.join(", ") || "Unknown author"}</p>
          <p className="muted">{book.description || "No description available."}</p>
          <div className="actions book-actions">
            <Link className="button" href={`/read/${book.id}`}>Read</Link>
            <a className="button secondary" href={`/api/books/${book.id}/download`}>Download EPUB</a>
          </div>
          <Link className="muted" href="/">← Back to browse</Link>
        </div>
      </div>
    </LibraryShell>
  );
}
