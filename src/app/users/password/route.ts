import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db/client";
import { kosyncUsers } from "@/db/schema";
import {
  authenticateKosync,
  hashKosyncCredential,
  kosyncError,
  kosyncJson,
} from "@/lib/kosync";

const passwordSchema = z.object({ password: z.string().min(1) });

export async function PUT(request: Request) {
  const user = await authenticateKosync(request);
  if (!user) return kosyncError("Unauthorized", 2001, 401);
  const parsed = passwordSchema.safeParse(await kosyncJson(request));
  if (!parsed.success) return kosyncError("Invalid request", 2003, 403);
  await getDb()
    .update(kosyncUsers)
    .set({ credentialHash: hashKosyncCredential(parsed.data.password) })
    .where(eq(kosyncUsers.id, user.id));
  return Response.json({ updated: true });
}
