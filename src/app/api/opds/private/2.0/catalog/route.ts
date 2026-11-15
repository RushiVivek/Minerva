import { NextResponse } from "next/server";

import { requireAuthentication } from "@/lib/auth";
import { browseCatalog } from "@/lib/catalog";
import { opdsRequestParams, toOpdsFeed } from "@/lib/opds";

export async function GET(
  request: Request,
  context: { params: Promise<{ slug?: string }> },
) {
  try {
    await requireAuthentication();
    const url = new URL(request.url);
    // The root catalog route has no params; the folder route re-exports this handler.
  const slug = (await context.params)?.slug;
    const params = opdsRequestParams(url);
    const view = await browseCatalog({ includePrivate: true, slug, ...params });
    if (!view) return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    return NextResponse.json(
      toOpdsFeed(view, {
        baseUrl: url.origin,
        catalogPath: "/api/opds/private/2.0/catalog",
        title: "Minerva Private Library",
        ...params,
      }),
    );
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
