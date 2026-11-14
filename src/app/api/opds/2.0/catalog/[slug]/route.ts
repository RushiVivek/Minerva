import { NextResponse } from "next/server";

import { listCatalogBooks } from "@/lib/catalog";
import { toOpdsPublication } from "@/lib/opds";

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const url = new URL(request.url);
  const { slug } = await context.params;
  try {
    const books = await listCatalogBooks({
      includePrivate: false,
      collectionSlug: slug,
      query: url.searchParams.get("q") ?? undefined,
    });
    return NextResponse.json({
      metadata: { title: `Minerva · ${slug}`, numberOfItems: books.length },
      links: [{
        rel: "self",
        href: url.href,
        type: "application/opds+json",
      }],
      navigation: [],
      publications: books.map((book) => toOpdsPublication(book, url.origin)),
    });
  } catch (error) {
    console.error("Failed to load OPDS collection", error);
    return NextResponse.json({ error: "Collection unavailable" }, { status: 503 });
  }
}
