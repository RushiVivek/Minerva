import { NextResponse } from "next/server";

import { listCatalogBooks } from "@/lib/catalog";
import { requireAuthentication } from "@/lib/auth";

export async function GET() {
  try {
    const principal = await requireAuthentication();
    if (principal.kind !== "admin") {
      return NextResponse.json({ error: "Admin authentication required" }, { status: 403 });
    }
    return NextResponse.json(
      await listCatalogBooks({ includePrivate: true, limit: 500 }),
    );
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    console.error("Failed to list admin books", error);
    return NextResponse.json({ error: "Book list unavailable" }, { status: 503 });
  }
}
