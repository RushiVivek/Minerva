import { NextResponse } from "next/server";

import { listCatalogBooks } from "@/lib/catalog";
import { requireAuthentication } from "@/lib/auth";
import { toOpdsPublication } from "@/lib/opds";

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    await requireAuthentication();
    const url = new URL(request.url);
    const { slug } = await context.params;
    const books = await listCatalogBooks({
      includePrivate: true,
      collectionSlug: slug,
      query: url.searchParams.get("q") ?? undefined,
    });
    return NextResponse.json({
      metadata: { title: `Minerva Private · ${slug}`, numberOfItems: books.length },
      links: [{
        rel: "self",
        href: url.href,
        type: "application/opds+json",
      }],
      navigation: [],
      publications: books.map((book) => toOpdsPublication(book, url.origin)),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    console.error("Failed to load private OPDS collection", error);
    return NextResponse.json({ error: "Collection unavailable" }, { status: 503 });
  }
}
