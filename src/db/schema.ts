import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const visibility = pgEnum("visibility", ["public", "private"]);

export const books = pgTable(
  "books",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    subtitle: text("subtitle"),
    description: text("description"),
    language: text("language").notNull().default("en"),
    publisher: text("publisher"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    identifier: text("identifier"),
    visibility: visibility("visibility").notNull().default("public"),
    cloudinaryPublicId: text("cloudinary_public_id").notNull(),
    cloudinaryResourceType: text("cloudinary_resource_type").notNull().default("raw"),
    mimeType: text("mime_type").notNull().default("application/epub+zip"),
    byteSize: integer("byte_size"),
    checksum: text("checksum"),
    coverCloudinaryPublicId: text("cover_cloudinary_public_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    identifierIndex: uniqueIndex("books_identifier_idx").on(table.identifier),
    titleIndex: index("books_title_idx").on(table.title),
    visibilityIndex: index("books_visibility_idx").on(table.visibility),
  }),
);

export const authors = pgTable("authors", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
});

export const collections = pgTable("collections", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
});

export const bookCollections = pgTable(
  "book_collections",
  {
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pairIndex: uniqueIndex("book_collections_pair_idx").on(
      table.bookId,
      table.collectionId,
    ),
  }),
);

export const bookAuthors = pgTable(
  "book_authors",
  {
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => authors.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pairIndex: uniqueIndex("book_authors_pair_idx").on(table.bookId, table.authorId),
  }),
);

export const apiTokens = pgTable("api_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
});

export const readingProgress = pgTable(
  "reading_progress",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tokenId: uuid("token_id")
      .notNull()
      .references(() => apiTokens.id, { onDelete: "cascade" }),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    location: text("location").notNull(),
    percentage: integer("percentage"),
    bookmarks: text("bookmarks").notNull().default("[]"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tokenBookIndex: uniqueIndex("reading_progress_token_book_idx").on(
      table.tokenId,
      table.bookId,
    ),
  }),
);
