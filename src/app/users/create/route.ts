import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db/client";
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

export async function POST(request: Request) {
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
