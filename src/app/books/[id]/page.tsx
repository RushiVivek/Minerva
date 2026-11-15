import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { LibraryShell } from "@/components/LibraryShell";
import { getCatalogBook, listCatalogCollections } from "@/lib/catalog";

type Props = { params: Promise<{ id: string }> };

const loadBook = cache((id: string) => getCatalogBook(id, { includePrivate: false }));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const book = await loadBook((await params).id);
  return { title: book?.title ?? "Book not found" };
}

export default async function BookPage({ params }: Props) {
  const book = await loadBook((await params).id);
  if (!book) notFound();
  const folder = book.collectionId
    ? (await listCatalogCollections(false)).find((item) => item.id === book.collectionId)
    : undefined;

  return (
    <LibraryShell>
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Library</Link>
        {folder && <span>/ <Link href={`/browse/${encodeURIComponent(folder.slug)}`}>{folder.name}</Link></span>}
      </nav>
      <article className="book-detail">
        <div className="book-detail-cover cover">
          {book.coverCloudinaryPublicId ? (
            <Image src={`/api/books/${book.id}/cover`} alt={`Cover of ${book.title}`} width={400} height={600} unoptimized priority />
          ) : (
            <span aria-hidden="true">{book.title}</span>
          )}
        </div>
        <div className="book-detail-content">
          <h1>{book.title}</h1>
          {book.subtitle && <p className="muted">{book.subtitle}</p>}
          <p className="book-author">{book.authors.join(", ") || "Unknown author"}</p>
          <div className="actions book-actions">
            <Link className="button" href={`/read/${book.id}`}>Read</Link>
            <a className="button secondary" href={`/api/books/${book.id}/download`}>Download EPUB</a>
          </div>
          <p className="book-description">{book.description || "No description available."}</p>
          <ul className="book-meta">
            {book.publisher && <li>{book.publisher}</li>}
            <li>Language: {book.language}</li>
          </ul>
        </div>
      </article>
    </LibraryShell>
  );
}
