import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/db/client";
import { apiTokens } from "@/db/schema";
import { requireAuthentication } from "@/lib/auth";
import { isUuid } from "@/lib/catalog";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const principal = await requireAuthentication();
    if (principal.kind !== "admin") {
      return NextResponse.json({ error: "Admin authentication required" }, { status: 403 });
    }
    const { id } = await context.params;
    if (!isUuid(id)) return NextResponse.json({ error: "Token not found" }, { status: 404 });
    await getDb().update(apiTokens).set({ active: false }).where(eq(apiTokens.id, id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    console.error("Failed to revoke API token", error);
    return NextResponse.json({ error: "Token service unavailable" }, { status: 503 });
  }
}
