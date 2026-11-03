import { NextResponse } from "next/server";

import { listCatalogBooks } from "@/lib/catalog";
import { toOpdsPublication } from "@/lib/opds";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? undefined;
  const offset = Number(url.searchParams.get("offset") ?? 0);

  try {
    const books = await listCatalogBooks({ includePrivate: false, query, offset });
    const baseUrl = url.origin;
    return NextResponse.json({
    metadata: {
      title: "Minerva Library",
      numberOfItems: books.length,
    },
    links: [
      {
        rel: "self",
        href: `${baseUrl}/api/opds/2.0/catalog`,
        type: "application/opds+json",
      },
      {
        rel: "search",
        href: `${baseUrl}/api/opds/2.0/catalog{?q}`,
        type: "application/opensearchdescription+xml",
        templated: true,
      },
    ],
    publications: books.map((book) => toOpdsPublication(book, baseUrl)),
    navigation: [],
    });
  } catch (error) {
    console.error("Failed to load OPDS catalog", error);
    return NextResponse.json(
      { error: "Catalog unavailable" },
      { status: 503 },
    );
  }
}
