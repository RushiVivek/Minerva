import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/db/client";
import { bookCollections, books, collections } from "@/db/schema";
import { requireAuthentication } from "@/lib/auth";

const bodySchema = z.object({ bookId: z.string().uuid() });

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const principal = await requireAuthentication();
    if (principal.kind !== "admin") {
      return NextResponse.json({ error: "Admin authentication required" }, { status: 403 });
    }
    const { id: collectionId } = await context.params;
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid book ID" }, { status: 400 });
    const [collection] = await getDb().select({ id: collections.id }).from(collections).where(eq(collections.id, collectionId)).limit(1);
    const [book] = await getDb().select({ id: books.id }).from(books).where(eq(books.id, parsed.data.bookId)).limit(1);
    if (!collection || !book) return NextResponse.json({ error: "Collection or book not found" }, { status: 404 });
    await getDb().insert(bookCollections).values({ collectionId, bookId: book.id }).onConflictDoNothing();
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    console.error("Failed to add book to collection", error);
    return NextResponse.json({ error: "Collection update failed" }, { status: 500 });
  }
}
