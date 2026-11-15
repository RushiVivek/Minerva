import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { getCatalogBook } from "@/lib/catalog";
import { ReaderLoader } from "./reader-loader";

type Props = { params: Promise<{ id: string }> };

const loadBook = cache((id: string) => getCatalogBook(id, { includePrivate: false }));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const book = await loadBook((await params).id);
  return { title: book?.title ?? "Book not found" };
}

export default async function ReadPage({ params }: Props) {
  const book = await loadBook((await params).id);
  if (!book) notFound();
  return <ReaderLoader bookId={book.id} title={book.title} author={book.authors.join(", ")} />;
}
