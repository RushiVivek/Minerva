import { createHash } from "node:crypto";

import { NextResponse } from "next/server";
import { eq, or } from "drizzle-orm";

import { getDb } from "@/db/client";
import { authors, bookAuthors, bookCollections, books, collections } from "@/db/schema";
import { requireAuthentication } from "@/lib/auth";
import { EpubError, extractEpubMetadata, validateEpub } from "@/lib/epub";
import { uploadCoverImage, uploadRawBook } from "@/lib/cloudinary";

export async function POST(request: Request) {
  try {
    const principal = await requireAuthentication();
    if (principal.kind !== "admin") {
      return NextResponse.json({ error: "Admin authentication required" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "An EPUB file is required" }, { status: 400 });
    }
    validateEpub(file);

    const buffer = Buffer.from(await file.arrayBuffer());
    const metadata = extractEpubMetadata(buffer);
    const checksum = createHash("sha256").update(buffer).digest("hex");
    const visibility = formData.get("visibility") === "private" ? "private" : "public";
    const collectionId = formData.get("collectionId");
    // Books are stored by checksum, so a second copy would share (and on
    // deletion take down) the first copy's file. The identifier is unique too.
    const [duplicate] = await getDb()
      .select({ title: books.title })
      .from(books)
      .where(
        metadata.identifier
          ? or(eq(books.checksum, checksum), eq(books.identifier, metadata.identifier))
          : eq(books.checksum, checksum),
      )
      .limit(1);
    if (duplicate) {
      return NextResponse.json(
        { error: `This book is already in the library as “${duplicate.title}”.` },
        { status: 409 },
      );
    }
    const publicId = `minerva/books/${checksum}`;
    const uploaded = await uploadRawBook(buffer, publicId);
    const book = await getDb().transaction(async (tx) => {
      const [createdBook] = await tx
        .insert(books)
        .values({
          title: metadata.title,
          language: metadata.language,
          identifier: metadata.identifier,
          visibility,
          cloudinaryPublicId: uploaded.public_id,
          cloudinaryResourceType: uploaded.resource_type,
          mimeType: "application/epub+zip",
          byteSize: file.size,
          checksum,
        })
        .returning({ id: books.id });

      if (metadata.creator) {
        const [author] = await tx
          .insert(authors)
          .values({ name: metadata.creator })
          .returning({ id: authors.id });
        await tx.insert(bookAuthors).values({
          bookId: createdBook.id,
          authorId: author.id,
        });
      }
      if (typeof collectionId === "string" && collectionId) {
        const [collection] = await tx.select({ id: collections.id }).from(collections).where(eq(collections.id, collectionId)).limit(1);
        if (collection) {
          await tx.insert(bookCollections).values({
            bookId: createdBook.id,
            collectionId: collection.id,
          });
        }
      }
      return createdBook;
    });

    if (metadata.cover && metadata.cover.data.length <= 5 * 1024 * 1024) {
      // The book is already saved; a cover that fails to store can be added by hand.
      try {
        const coverPublicId = `minerva/covers/${book.id}`;
        await uploadCoverImage(Buffer.from(metadata.cover.data), coverPublicId, metadata.cover.contentType);
        await getDb().update(books).set({ coverCloudinaryPublicId: coverPublicId }).where(eq(books.id, book.id));
      } catch (error) {
        console.error("Failed to store the book's cover", error);
      }
    }

    return NextResponse.json({ id: book.id }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (error instanceof EpubError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Failed to upload book", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
