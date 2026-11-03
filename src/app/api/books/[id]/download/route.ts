import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/db/client";
import { books } from "@/db/schema";
import { authenticateRequest } from "@/lib/auth";
import { rawAssetUrl } from "@/lib/cloudinary";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const [book] = await getDb()
    .select()
    .from(books)
    .where(eq(books.id, id))
    .limit(1);
  if (!book) return NextResponse.json({ error: "Book not found" }, { status: 404 });

  if (book.visibility === "private") {
    const principal = await authenticateRequest(
      request.headers.get("authorization"),
    );
    if (!principal) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401, headers: { "www-authenticate": 'Basic realm="Minerva"' } },
      );
    }
  }

  return NextResponse.redirect(rawAssetUrl(book.cloudinaryPublicId));
}
