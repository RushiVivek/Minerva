import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/db/client";
import { books, readingProgress } from "@/db/schema";
import { requireAuthentication } from "@/lib/auth";

const progressSchema = z.object({
  location: z.string().min(1).max(2000),
  percentage: z.number().int().min(0).max(100).nullable().optional(),
  bookmarks: z.array(z.string().max(2000)).max(500).optional(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ bookId: string }> },
) {
  try {
    const principal = await requireAuthentication();
    if (!principal.tokenId) {
      return NextResponse.json(
        { error: "A bearer API token is required for progress sync" },
        { status: 403 },
      );
    }
    const { bookId } = await context.params;
    const [progress] = await getDb()
      .select()
      .from(readingProgress)
      .where(
        and(
          eq(readingProgress.bookId, bookId),
          eq(readingProgress.tokenId, principal.tokenId),
        ),
      )
      .limit(1);
    return NextResponse.json(
      progress
        ? {
            location: progress.location,
            percentage: progress.percentage,
            bookmarks: JSON.parse(progress.bookmarks),
            updatedAt: progress.updatedAt,
          }
        : null,
    );
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    console.error("Failed to load reading progress", error);
    return NextResponse.json({ error: "Progress unavailable" }, { status: 503 });
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ bookId: string }> },
) {
  try {
    const principal = await requireAuthentication();
    if (!principal.tokenId) {
      return NextResponse.json(
        { error: "A bearer API token is required for progress sync" },
        { status: 403 },
      );
    }
    const { bookId } = await context.params;
    const [book] = await getDb()
      .select({ id: books.id })
      .from(books)
      .where(eq(books.id, bookId))
      .limit(1);
    if (!book) return NextResponse.json({ error: "Book not found" }, { status: 404 });

    const parsed = progressSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid progress payload" }, { status: 400 });
    }
    const progress = parsed.data;
    await getDb()
      .insert(readingProgress)
      .values({
        tokenId: principal.tokenId,
        bookId,
        location: progress.location,
        percentage: progress.percentage ?? null,
        bookmarks: JSON.stringify(progress.bookmarks ?? []),
      })
      .onConflictDoUpdate({
        target: [readingProgress.tokenId, readingProgress.bookId],
        set: {
          location: progress.location,
          percentage: progress.percentage ?? null,
          bookmarks: JSON.stringify(progress.bookmarks ?? []),
          updatedAt: new Date(),
        },
      });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    console.error("Failed to save reading progress", error);
    return NextResponse.json({ error: "Progress unavailable" }, { status: 503 });
  }
}
