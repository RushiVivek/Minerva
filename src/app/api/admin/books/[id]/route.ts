import { and, eq, ne } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/db/client";
import { authors, bookAuthors, bookCollections, books } from "@/db/schema";
import { requireAuthentication } from "@/lib/auth";
import { isUuid } from "@/lib/catalog";
import { deleteBookFile } from "@/lib/book-storage";
import { deleteCoverImage, uploadCoverImage } from "@/lib/cloudinary";

const updateSchema = z.object({
  title: z.string().trim().min(1).max(500),
  subtitle: z.string().trim().max(500).nullable(),
  description: z.string().trim().max(10000).nullable(),
  language: z.string().trim().min(1).max(20),
  publisher: z.string().trim().max(500).nullable(),
  identifier: z.string().trim().max(500).nullable(),
  author: z.string().trim().max(500).nullable(),
  visibility: z.enum(["public", "private"]),
  collectionId: z.string().uuid().nullable().optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const principal = await requireAuthentication();
    if (principal.kind !== "admin") {
      return NextResponse.json({ error: "Admin authentication required" }, { status: 403 });
    }
    const { id } = await context.params;
    const contentType = request.headers.get("content-type") ?? "";
    let rawData: Record<string, unknown>;
    let cover: File | null = null;
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      rawData = Object.fromEntries(
        [...form.entries()].filter(([key, value]) => key !== "cover" && typeof value === "string"),
      );
      const uploadedCover = form.get("cover");
      cover = uploadedCover instanceof File && uploadedCover.size > 0 ? uploadedCover : null;
    } else {
      rawData = await request.json();
    }
    const parsed = updateSchema.safeParse({
      ...rawData,
      subtitle: rawData.subtitle || null,
      description: rawData.description || null,
      publisher: rawData.publisher || null,
      identifier: rawData.identifier || null,
      author: rawData.author || null,
      ...(rawData.collectionId !== undefined
        ? { collectionId: rawData.collectionId || null }
        : {}),
    });
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid book metadata" }, { status: 400 });
    }
    const existing = isUuid(id)
      ? await getDb().select().from(books).where(eq(books.id, id)).limit(1)
      : [];
    if (!existing[0]) return NextResponse.json({ error: "Book not found" }, { status: 404 });

    let coverCloudinaryPublicId = existing[0].coverCloudinaryPublicId;
    if (cover) {
      if (!cover.type.startsWith("image/") || cover.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: "Cover must be an image up to 5 MB" }, { status: 400 });
      }
      coverCloudinaryPublicId = `minerva/covers/${id}`;
      await uploadCoverImage(
        Buffer.from(await cover.arrayBuffer()),
        coverCloudinaryPublicId,
        cover.type,
      );
    }
    const { author, collectionId, ...bookMetadata } = parsed.data;
    await getDb().transaction(async (tx) => {
      await tx
        .update(books)
        .set({ ...bookMetadata, coverCloudinaryPublicId, updatedAt: new Date() })
        .where(eq(books.id, id));
      // The form shows all authors as one string. Leave them alone unless that
      // string was edited, so saving other fields never merges co-authors.
      const current = await tx
        .select({ name: authors.name })
        .from(bookAuthors)
        .innerJoin(authors, eq(authors.id, bookAuthors.authorId))
        .where(eq(bookAuthors.bookId, id))
        .orderBy(authors.name);
      if ((author ?? "") !== current.map((row) => row.name).join(", ")) {
        await tx.delete(bookAuthors).where(eq(bookAuthors.bookId, id));
        if (author) {
          const [sameName] = await tx.select().from(authors).where(eq(authors.name, author)).limit(1);
          const [target] = sameName
            ? [sameName]
            : await tx.insert(authors).values({ name: author }).returning();
          await tx.insert(bookAuthors).values({ bookId: id, authorId: target.id });
        }
      }
      if (collectionId !== undefined) {
        await tx.delete(bookCollections).where(eq(bookCollections.bookId, id));
        if (collectionId) {
          await tx.insert(bookCollections).values({ bookId: id, collectionId });
        }
      }
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    console.error("Failed to update book", error);
    return NextResponse.json({ error: "Book update failed" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const principal = await requireAuthentication();
    if (principal.kind !== "admin") {
      return NextResponse.json({ error: "Admin authentication required" }, { status: 403 });
    }
    const { id } = await context.params;
    const [book] = isUuid(id)
      ? await getDb().select().from(books).where(eq(books.id, id)).limit(1)
      : [];
    if (!book) return NextResponse.json({ error: "Book not found" }, { status: 404 });
    // Older duplicate uploads can point at the same stored file.
    const [sharesFile] = await getDb()
      .select({ id: books.id })
      .from(books)
      .where(and(eq(books.cloudinaryPublicId, book.cloudinaryPublicId), ne(books.id, id)))
      .limit(1);
    await getDb().delete(books).where(eq(books.id, id));
    // The book is gone from the library either way; a failed cleanup only
    // leaves an unreferenced file behind.
    await Promise.all([
      sharesFile ? null : deleteBookFile(book),
      book.coverCloudinaryPublicId ? deleteCoverImage(book.coverCloudinaryPublicId) : null,
    ]).catch((error) => console.error("Failed to remove stored files for deleted book", error));
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    console.error("Failed to delete book", error);
    return NextResponse.json({ error: "Book deletion failed" }, { status: 500 });
  }
}
