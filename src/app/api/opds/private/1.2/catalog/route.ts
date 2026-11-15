import { NextResponse } from "next/server";

import { listCatalogBooks } from "@/lib/catalog";
import { requireAuthentication } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    await requireAuthentication();
    const url = new URL(request.url);
    const books = await listCatalogBooks({ includePrivate: true, limit: 500 });
    const entries = books
      .map(
        (book) =>
          `<entry><id>urn:minerva:book:${book.id}</id>` +
          `<title>${escapeXml(book.title)}</title>` +
          `<author><name>${escapeXml(book.authors.join(", ") || "Unknown")}</name></author>` +
          `<link rel="http://opds-spec.org/acquisition" href="${url.origin}/api/books/${book.id}/download" type="application/epub+zip"/></entry>`,
      )
      .join("");
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>` +
        `<feed xmlns="http://www.w3.org/2005/Atom" xmlns:opds="http://opds-spec.org/2010/catalog">` +
        `<id>urn:minerva:private-catalog</id><title>Minerva Private Library</title>` +
        `<updated>${new Date().toISOString()}</updated>${entries}</feed>`,
      {
        headers: {
          "content-type":
            "application/atom+xml;profile=opds-catalog;kind=acquisition",
        },
      },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return new NextResponse("Authentication required", {
        status: 401,
        headers: { "www-authenticate": 'Basic realm="Minerva"' },
      });
    }
    console.error("Failed to load private OPDS 1.2 catalog", error);
    return new NextResponse("Catalog unavailable", { status: 503 });
  }
}

function escapeXml(value: string) {
  return value.replace(
    /[<>&'"]/g,
    (character) =>
      ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[
        character
      ] ?? character,
  );
}
