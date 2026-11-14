import { NextResponse } from "next/server";

import { listCatalogBooks, listCatalogCollections } from "@/lib/catalog";
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
    const allCollections = await listCatalogCollections(true);
    const current = allCollections.find((collection) => collection.slug === slug);
    const children = current
      ? allCollections.filter((collection) => collection.parentId === current.id)
      : [];
    return NextResponse.json({
      metadata: { title: `Minerva Private · ${slug}`, numberOfItems: books.length },
      links: [{
        rel: "self",
        href: url.href,
        type: "application/opds+json",
      }],
      navigation: children.map((collection) => ({
        title: collection.name,
        subtitle: collection.description ?? undefined,
        links: [{
          rel: "subsection",
          href: `${url.origin}/api/opds/private/2.0/catalog/${encodeURIComponent(collection.slug)}`,
          type: "application/opds+json",
        }],
      })),
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
