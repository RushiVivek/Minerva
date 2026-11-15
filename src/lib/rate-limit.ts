import { and, eq, gt, lt, sql } from "drizzle-orm";

import { getDb } from "@/db/client";
import { authFailures } from "@/db/schema";

const WINDOW_MINUTES = 15;
// Readest retries a rejected sync login once with Basic auth, so one wrong
// password there costs two attempts.
const MAX_FAILURES = 20;

const windowStart = () => new Date(Date.now() - WINDOW_MINUTES * 60_000);

/** Identifies the caller by the address the hosting platform reports. */
export function clientKey(headers: Headers, scope: string) {
  const address =
    headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    headers.get("x-real-ip") ||
    "unknown";
  return `${scope}:${address}`;
}

export async function isLockedOut(key: string) {
  const [row] = await getDb()
    .select({ count: authFailures.count })
    .from(authFailures)
    .where(and(eq(authFailures.key, key), gt(authFailures.windowStart, windowStart())))
    .limit(1);
  return (row?.count ?? 0) >= MAX_FAILURES;
}

export async function recordFailure(key: string) {
  const db = getDb();
  const expired = lt(authFailures.windowStart, windowStart());
  await db.delete(authFailures).where(expired);
  await db
    .insert(authFailures)
    .values({ key, count: 1 })
    .onConflictDoUpdate({
      target: authFailures.key,
      set: { count: sql`${authFailures.count} + 1` },
    });
}
