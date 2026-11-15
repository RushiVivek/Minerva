import { createHash, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { kosyncUsers } from "@/db/schema";
import { clientKey, isLockedOut, recordFailure } from "@/lib/rate-limit";

export const KOSYNC_ACCEPT = "application/vnd.koreader.v1+json";

export function hashKosyncCredential(credential: string) {
  return createHash("sha256").update(credential).digest("hex");
}

export function validKosyncUsername(username: unknown) {
  return typeof username === "string" && username.length > 0 && !username.includes(":");
}

export function validKosyncDocument(document: unknown) {
  return (
    typeof document === "string" &&
    /^[A-Za-z0-9_]+$/.test(document) &&
    document.length > 0
  );
}

export function kosyncError(message: string, code: number, status: number) {
  return Response.json({ message, code }, { status });
}

export async function authenticateKosync(request: Request) {
  const username = request.headers.get("x-auth-user");
  const credential = request.headers.get("x-auth-key");
  if (
    typeof username !== "string" ||
    !validKosyncUsername(username) ||
    !credential
  ) {
    return null;
  }
  const limitKey = clientKey(request.headers, "kosync");
  if (await isLockedOut(limitKey)) return null;
  const user = await findKosyncUser(username, credential);
  if (!user) await recordFailure(limitKey);
  return user;
}

async function findKosyncUser(username: string, credential: string) {
  const [user] = await getDb()
    .select({ id: kosyncUsers.id, credentialHash: kosyncUsers.credentialHash })
    .from(kosyncUsers)
    .where(eq(kosyncUsers.username, username))
    .limit(1);
  if (!user) return null;
  const actual = Buffer.from(hashKosyncCredential(credential));
  const expected = Buffer.from(user.credentialHash);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  return { id: user.id, username };
}

export function kosyncJson(request: Request) {
  return request.json().catch(() => null) as Promise<unknown>;
}
