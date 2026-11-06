import { and, asc, eq, ilike, or } from "drizzle-orm";

import { getDb } from "@/db/client";
import { authors, bookAuthors, books } from "@/db/schema";

export type CatalogBook = {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  language: string;
  publisher: string | null;
  identifier: string | null;
  visibility: "public" | "private";
  cloudinaryPublicId: string;
  coverCloudinaryPublicId: string | null;
  authors: string[];
};

export async function listCatalogBooks(options: {
  includePrivate: boolean;
  query?: string;
  limit?: number;
  offset?: number;
}): Promise<CatalogBook[]> {
  const { includePrivate, query, limit = 50, offset = 0 } = options;
  const visibilityFilter = includePrivate
    ? undefined
    : eq(books.visibility, "public");
  const searchFilter = query?.trim()
    ? or(
        ilike(books.title, `%${query.trim()}%`),
        ilike(books.subtitle, `%${query.trim()}%`),
        ilike(books.description, `%${query.trim()}%`),
        ilike(authors.name, `%${query.trim()}%`),
      )
    : undefined;

  const rows = await getDb()
    .select({
      id: books.id,
      title: books.title,
      subtitle: books.subtitle,
      description: books.description,
      language: books.language,
      publisher: books.publisher,
      identifier: books.identifier,
      visibility: books.visibility,
      cloudinaryPublicId: books.cloudinaryPublicId,
      coverCloudinaryPublicId: books.coverCloudinaryPublicId,
      author: authors.name,
    })
    .from(books)
    .leftJoin(bookAuthors, eq(bookAuthors.bookId, books.id))
    .leftJoin(authors, eq(authors.id, bookAuthors.authorId))
    .where(and(visibilityFilter, searchFilter))
    .orderBy(asc(books.title))
    .limit(Math.min(Math.max(limit, 1), 100))
    .offset(Math.max(offset, 0));

  const grouped = new Map<string, CatalogBook>();
  for (const row of rows) {
    const book = grouped.get(row.id) ?? {
      id: row.id,
      title: row.title,
      subtitle: row.subtitle,
      description: row.description,
      language: row.language,
      publisher: row.publisher,
      identifier: row.identifier,
      visibility: row.visibility,
      cloudinaryPublicId: row.cloudinaryPublicId,
      coverCloudinaryPublicId: row.coverCloudinaryPublicId,
      authors: [],
    };
    if (row.author) book.authors.push(row.author);
    grouped.set(row.id, book);
  }
  return [...grouped.values()];
}
