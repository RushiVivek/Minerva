import { NextResponse } from "next/server";

import { listCatalogBooks } from "@/lib/catalog";
import { requireAuthentication } from "@/lib/auth";
import { toOpdsPublication } from "@/lib/opds";

export async function GET(request: Request) {
  try {
    await requireAuthentication();
    const url = new URL(request.url);
    const books = await listCatalogBooks({
      includePrivate: true,
      query: url.searchParams.get("q") ?? undefined,
    });
    return NextResponse.json({
      metadata: { title: "Minerva Private Library", numberOfItems: books.length },
      links: [
        {
          rel: "self",
          href: `${url.origin}/api/opds/private/2.0/catalog`,
          type: "application/opds+json",
        },
      ],
      navigation: [],
      publications: books.map((book) => toOpdsPublication(book, url.origin)),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401, headers: { "www-authenticate": 'Basic realm="Minerva"' } },
      );
    }
    console.error("Failed to load private OPDS catalog", error);
    return NextResponse.json({ error: "Catalog unavailable" }, { status: 503 });
  }
}
