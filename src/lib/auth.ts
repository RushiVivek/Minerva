import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { headers } from "next/headers";

import { and, eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { apiTokens } from "@/db/schema";
import { clientKey, isLockedOut, recordFailure } from "@/lib/rate-limit";

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function verifyBearerToken(
  authorization: string | null,
  expectedHash: string,
): boolean {
  if (!authorization?.startsWith("Bearer ")) return false;
  const actual = Buffer.from(hashToken(authorization.slice(7)));
  const expected = Buffer.from(expectedHash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function getAuthorizationHeader() {
  return (await headers()).get("authorization");
}

export function parseBasicCredentials(authorization: string | null) {
  if (!authorization?.startsWith("Basic ")) return null;
  try {
    const decoded = Buffer.from(authorization.slice(6), "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator < 1) return null;
    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1),
    };
  } catch {
    return null;
  }
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, encoded: string) {
  // `.env` files need each `$` escaped as `\$`, but a host's real environment
  // variables are passed through verbatim; accept the hash written either way.
  const [algorithm, salt, expectedHex] = encoded.trim().replaceAll("\\$", "$").split("$");
  if (algorithm !== "scrypt" || !salt || !expectedHex) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function authenticateRequest(authorization: string | null) {
  if (!authorization) return null;
  // Too many wrong credentials from this address: refuse without checking, so
  // neither the password nor a token can be guessed at speed.
  const limitKey = clientKey(await headers(), "api");
  if (await isLockedOut(limitKey)) return null;
  const principal = await checkCredentials(authorization);
  if (!principal) await recordFailure(limitKey);
  return principal;
}

async function checkCredentials(authorization: string) {
  const basic = parseBasicCredentials(authorization);
  if (basic) {
    const username = process.env.ADMIN_USERNAME;
    const passwordHash = process.env.ADMIN_PASSWORD_HASH;
    if (
      username &&
      passwordHash &&
      basic.username === username &&
      verifyPassword(basic.password, passwordHash)
    ) {
      return { kind: "admin" as const, tokenId: null };
    }
  }

  if (!authorization.startsWith("Bearer ")) return null;
  const tokenHash = hashToken(authorization.slice(7));
  const [token] = await getDb()
    .select({ id: apiTokens.id })
    .from(apiTokens)
    .where(and(eq(apiTokens.tokenHash, tokenHash), eq(apiTokens.active, true)))
    .limit(1);
  if (!token) return null;
  await getDb()
    .update(apiTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiTokens.id, token.id));
  return { kind: "token" as const, tokenId: token.id };
}

export async function requireAuthentication() {
  const authorization = (await headers()).get("authorization");
  const principal = await authenticateRequest(authorization);
  if (!principal) {
    throw new Error("UNAUTHORIZED");
  }
  return principal;
}
