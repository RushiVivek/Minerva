import { NextResponse } from "next/server";

import { browseCatalog } from "@/lib/catalog";
import { opdsRequestParams, toOpdsFeed } from "@/lib/opds";

export async function GET(
  request: Request,
  context: { params: Promise<{ slug?: string }> },
) {
  const url = new URL(request.url);
  // The root catalog route has no params; the folder route re-exports this handler.
  const slug = (await context.params)?.slug;
  const params = opdsRequestParams(url);
  try {
    const view = await browseCatalog({ includePrivate: false, slug, ...params });
    if (!view) return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    return NextResponse.json(
      toOpdsFeed(view, {
        baseUrl: url.origin,
        catalogPath: "/api/opds/2.0/catalog",
        title: "Minerva Library",
        ...params,
      }),
    );
  } catch (error) {
    console.error("Failed to load OPDS catalog", error);
    return NextResponse.json({ error: "Catalog unavailable" }, { status: 503 });
  }
}
