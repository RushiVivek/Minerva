import { and, asc, eq, exists, ilike, inArray, notExists, or, sql } from "drizzle-orm";

import { getDb } from "@/db/client";
import {
  authors,
  bookAuthors,
  bookCollections,
  books,
  collections,
} from "@/db/schema";

export const CATALOG_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 500;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Route params reach Postgres as uuid values; anything else must 404, not throw. */
export function isUuid(value: string) {
  return UUID_PATTERN.test(value);
}

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
  collectionId: string | null;
  authors: string[];
};

export type CatalogCollection = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  parentId: string | null;
};

export async function listCatalogBooks(options: {
  includePrivate: boolean;
  query?: string;
  limit?: number;
  offset?: number;
  /** Only books filed directly in one of these collections. */
  collectionIds?: string[];
  /** Only books that are not filed in any collection. */
  rootOnly?: boolean;
  id?: string;
}): Promise<CatalogBook[]> {
  const {
    includePrivate,
    query,
    limit = CATALOG_PAGE_SIZE,
    offset = 0,
    collectionIds,
    rootOnly = false,
    id,
  } = options;
  if (collectionIds && collectionIds.length === 0) return [];
  const db = getDb();
  const one = { one: sql`1` };
  const pattern = query?.trim()
    ? `%${query.trim().replace(/[\\%_]/g, "\\$&")}%`
    : undefined;

  // Filter and paginate on books alone, so that a book with several authors or
  // folders still counts as one row against the limit.
  const rows = await db
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
    })
    .from(books)
    .where(
      and(
        id ? eq(books.id, id) : undefined,
        includePrivate ? undefined : eq(books.visibility, "public"),
        pattern
          ? or(
              ilike(books.title, pattern),
              ilike(books.subtitle, pattern),
              ilike(books.description, pattern),
              exists(
                db
                  .select(one)
                  .from(bookAuthors)
                  .innerJoin(authors, eq(authors.id, bookAuthors.authorId))
                  .where(and(eq(bookAuthors.bookId, books.id), ilike(authors.name, pattern))),
              ),
            )
          : undefined,
        collectionIds
          ? exists(
              db
                .select(one)
                .from(bookCollections)
                .where(
                  and(
                    eq(bookCollections.bookId, books.id),
                    inArray(bookCollections.collectionId, collectionIds),
                  ),
                ),
            )
          : undefined,
        rootOnly
          ? notExists(
              db.select(one).from(bookCollections).where(eq(bookCollections.bookId, books.id)),
            )
          : undefined,
      ),
    )
    .orderBy(asc(books.title), asc(books.id))
    .limit(Math.min(Math.max(limit, 1), MAX_PAGE_SIZE))
    .offset(Math.max(offset, 0));
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);
  const authorRows = await db
    .select({ bookId: bookAuthors.bookId, name: authors.name })
    .from(bookAuthors)
    .innerJoin(authors, eq(authors.id, bookAuthors.authorId))
    .where(inArray(bookAuthors.bookId, ids))
    .orderBy(asc(authors.name));
  const collectionRows = await db
    .select({ bookId: bookCollections.bookId, collectionId: bookCollections.collectionId })
    .from(bookCollections)
    .where(inArray(bookCollections.bookId, ids));

  const authorsByBook = new Map<string, string[]>();
  for (const row of authorRows) {
    authorsByBook.set(row.bookId, [...(authorsByBook.get(row.bookId) ?? []), row.name]);
  }
  const collectionByBook = new Map(collectionRows.map((row) => [row.bookId, row.collectionId]));

  return rows.map((row) => ({
    ...row,
    collectionId: collectionByBook.get(row.id) ?? null,
    authors: authorsByBook.get(row.id) ?? [],
  }));
}

export async function getCatalogBook(id: string, options: { includePrivate: boolean }) {
  if (!isUuid(id)) return null;
  const [book] = await listCatalogBooks({ ...options, id, limit: 1 });
  return book ?? null;
}

/**
 * Keeps the collections that lead to at least one book: those holding a book
 * directly, plus every ancestor of such a collection.
 */
export function collectionsWithBooks<T extends { id: string; parentId: string | null }>(
  all: T[],
  idsHoldingBooks: Iterable<string>,
): T[] {
  const byId = new Map(all.map((collection) => [collection.id, collection]));
  const keep = new Set<string>();
  for (const id of idsHoldingBooks) {
    let current = byId.get(id);
    while (current && !keep.has(current.id)) {
      keep.add(current.id);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
  }
  return all.filter((collection) => keep.has(collection.id));
}

export async function listCatalogCollections(includePrivate: boolean): Promise<CatalogCollection[]> {
  const db = getDb();
  const all = await db
    .select({
      id: collections.id,
      slug: collections.slug,
      name: collections.name,
      description: collections.description,
      parentId: collections.parentId,
    })
    .from(collections)
    .orderBy(asc(collections.name));
  const holding = await db
    .selectDistinct({ id: bookCollections.collectionId })
    .from(bookCollections)
    .innerJoin(books, eq(books.id, bookCollections.bookId))
    .where(includePrivate ? undefined : eq(books.visibility, "public"));
  return collectionsWithBooks(all, holding.map((row) => row.id));
}

function subtreeIds(all: CatalogCollection[], rootId: string) {
  const ids = [rootId];
  for (let index = 0; index < ids.length; index += 1) {
    for (const collection of all) {
      if (collection.parentId === ids[index] && !ids.includes(collection.id)) {
        ids.push(collection.id);
      }
    }
  }
  return ids;
}

export type CatalogView = {
  /** The folder being browsed; null at the library root. */
  collection: CatalogCollection | null;
  /** Root-first chain of folders above `collection`. */
  ancestors: CatalogCollection[];
  /** Sub-folders to show; empty while searching. */
  folders: CatalogCollection[];
  books: CatalogBook[];
  hasMore: boolean;
};

/**
 * One page of the library as both the web UI and the OPDS feeds show it.
 * Browsing lists the books filed directly in the folder (or in no folder, at
 * the root); searching looks through the folder and everything beneath it.
 * Returns null when `slug` names no folder visible to this audience.
 */
export async function browseCatalog(options: {
  includePrivate: boolean;
  slug?: string;
  query?: string;
  offset?: number;
  limit?: number;
}): Promise<CatalogView | null> {
  const { includePrivate, slug, offset = 0, limit = CATALOG_PAGE_SIZE } = options;
  const query = options.query?.trim() || undefined;
  const all = await listCatalogCollections(includePrivate);
  const collection = slug ? all.find((item) => item.slug === slug) : null;
  if (slug && !collection) return null;

  const ancestors: CatalogCollection[] = [];
  let parent = collection?.parentId;
  while (parent) {
    const found = all.find((item) => item.id === parent);
    if (!found || ancestors.includes(found)) break;
    ancestors.unshift(found);
    parent = found.parentId;
  }

  const page = await listCatalogBooks({
    includePrivate,
    query,
    offset,
    limit: limit + 1,
    collectionIds: collection
      ? query
        ? subtreeIds(all, collection.id)
        : [collection.id]
      : undefined,
    rootOnly: !collection && !query,
  });

  return {
    collection: collection ?? null,
    ancestors,
    folders: query ? [] : all.filter((item) => item.parentId === (collection?.id ?? null)),
    books: page.slice(0, limit),
    hasMore: page.length > limit,
  };
}
