import { NextResponse } from "next/server";

import { listCatalogBooks, listCatalogCollections } from "@/lib/catalog";
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
    const allCollections = await listCatalogCollections(false);
    const current = allCollections.find((collection) => collection.slug === slug);
    const children = current
      ? allCollections.filter((collection) => collection.parentId === current.id)
      : [];
    return NextResponse.json({
      metadata: { title: `Minerva · ${slug}`, numberOfItems: books.length },
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
          href: `${url.origin}/api/opds/2.0/catalog/${encodeURIComponent(collection.slug)}`,
          type: "application/opds+json",
        }],
      })),
      publications: books.map((book) => toOpdsPublication(book, url.origin)),
    });
  } catch (error) {
    console.error("Failed to load OPDS collection", error);
    return NextResponse.json({ error: "Collection unavailable" }, { status: 503 });
  }
}
