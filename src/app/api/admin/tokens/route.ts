import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/db/client";
import { apiTokens } from "@/db/schema";
import { hashToken, requireAuthentication } from "@/lib/auth";

const tokenSchema = z.object({ name: z.string().trim().min(1).max(100) });

export async function GET() {
  try {
    const principal = await requireAuthentication();
    if (principal.kind !== "admin") {
      return NextResponse.json({ error: "Admin authentication required" }, { status: 403 });
    }
    const tokens = await getDb()
      .select({
        id: apiTokens.id,
        name: apiTokens.name,
        active: apiTokens.active,
        createdAt: apiTokens.createdAt,
        lastUsedAt: apiTokens.lastUsedAt,
      })
      .from(apiTokens);
    return NextResponse.json(tokens);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    console.error("Failed to list API tokens", error);
    return NextResponse.json({ error: "Token service unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const principal = await requireAuthentication();
    if (principal.kind !== "admin") {
      return NextResponse.json({ error: "Admin authentication required" }, { status: 403 });
    }
    const parsed = tokenSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "A token name is required" }, { status: 400 });
    }

    const token = randomBytes(32).toString("base64url");
    const [created] = await getDb()
      .insert(apiTokens)
      .values({ name: parsed.data.name, tokenHash: hashToken(token) })
      .returning({ id: apiTokens.id, name: apiTokens.name });
    return NextResponse.json({ ...created, token }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    console.error("Failed to create API token", error);
    return NextResponse.json({ error: "Token service unavailable" }, { status: 503 });
  }
}
