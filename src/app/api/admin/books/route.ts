import { createHash } from "node:crypto";

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { authors, bookAuthors, books } from "@/db/schema";
import { requireAuthentication } from "@/lib/auth";
import { extractEpubMetadata, validateEpub } from "@/lib/epub";
import { uploadRawBook } from "@/lib/cloudinary";

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
      return createdBook;
    });

    return NextResponse.json({ id: book.id }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Failed to upload book", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
