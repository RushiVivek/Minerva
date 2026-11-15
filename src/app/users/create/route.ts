import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db/client";
import { authenticateRequest } from "@/lib/auth";
import { kosyncUsers } from "@/db/schema";
import {
  hashKosyncCredential,
  kosyncError,
  kosyncJson,
  validKosyncUsername,
} from "@/lib/kosync";

const createSchema = z.object({
  username: z.string(),
  password: z.string(),
});

// Sync clients register without credentials, which would let anyone create
// accounts on a personal server. Accounts are created from the admin page.
export async function POST(request: Request) {
  const principal = await authenticateRequest(request.headers.get("authorization"));
  if (principal?.kind !== "admin") {
    return kosyncError("Registration is disabled. Create the account on the Minerva admin page.", 2005, 403);
  }
  const body = await kosyncJson(request);
  const parsed = createSchema.safeParse(body);
  if (
    !parsed.success ||
    !validKosyncUsername(parsed.data.username) ||
    parsed.data.password.length === 0
  ) {
    return kosyncError("Invalid request", 2003, 403);
  }
  const existing = await getDb()
    .select({ id: kosyncUsers.id })
    .from(kosyncUsers)
    .where(eq(kosyncUsers.username, parsed.data.username))
    .limit(1);
  if (existing[0]) {
    return kosyncError("Username is already registered.", 2002, 402);
  }
  await getDb().insert(kosyncUsers).values({
    username: parsed.data.username,
    credentialHash: hashKosyncCredential(parsed.data.password),
  });
  return Response.json({ username: parsed.data.username }, { status: 201 });
}
