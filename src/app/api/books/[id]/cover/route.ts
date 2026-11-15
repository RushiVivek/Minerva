import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/db/client";
import { books } from "@/db/schema";
import { authenticateRequest } from "@/lib/auth";
import { isUuid } from "@/lib/catalog";
import { imageAssetUrl } from "@/lib/cloudinary";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const [book] = isUuid(id)
    ? await getDb().select().from(books).where(eq(books.id, id)).limit(1)
    : [];
  if (!book) return NextResponse.json({ error: "Book not found" }, { status: 404 });
  if (book.visibility === "private" && !(await authenticateRequest(request.headers.get("authorization")))) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (!book.coverCloudinaryPublicId) {
    return NextResponse.json({ error: "Cover not found" }, { status: 404 });
  }
  return NextResponse.redirect(imageAssetUrl(book.coverCloudinaryPublicId));
}
