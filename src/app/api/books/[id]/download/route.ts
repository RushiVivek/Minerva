import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/db/client";
import { books } from "@/db/schema";
import { authenticateRequest } from "@/lib/auth";
import { rawAssetUrl } from "@/lib/cloudinary";

function downloadName(title: string) {
  const safeTitle = title
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 120);
  return `${safeTitle || "book"}.epub`;
}

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

  const asset = await fetch(rawAssetUrl(book.cloudinaryPublicId));
  if (!asset.ok || !asset.body) {
    return NextResponse.json({ error: "Book asset unavailable" }, { status: 502 });
  }

  return new Response(asset.body, {
    headers: {
      "content-type": "application/epub+zip",
      "content-disposition": `attachment; filename="${downloadName(book.title)}"; filename*=UTF-8''${encodeURIComponent(downloadName(book.title))}`,
      "cache-control": "private, max-age=60",
    },
  });
}
