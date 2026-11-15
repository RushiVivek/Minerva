import { NextResponse } from "next/server";
import { listCatalogBooks } from "@/lib/catalog";

export async function GET(request: Request) {
  const url = new URL(request.url);
  let books;
  try {
    books = await listCatalogBooks({ includePrivate: false, limit: 500 });
  } catch (error) {
    console.error("Failed to load OPDS 1.2 catalog", error);
    return new NextResponse("Catalog unavailable", { status: 503 });
  }

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
      `<feed xmlns="http://www.w3.org/2005/Atom" ` +
      `xmlns:opds="http://opds-spec.org/2010/catalog">` +
      `<id>urn:minerva:catalog</id><title>Minerva Library</title>` +
      `<updated>${new Date().toISOString()}</updated>${entries}</feed>`,
    {
      headers: {
        "content-type": "application/atom+xml;profile=opds-catalog;kind=acquisition",
      },
    },
  );
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
