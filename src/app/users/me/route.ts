import { eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { kosyncUsers } from "@/db/schema";
import { authenticateKosync, kosyncError } from "@/lib/kosync";

export async function DELETE(request: Request) {
  const user = await authenticateKosync(request);
  if (!user) return kosyncError("Unauthorized", 2001, 401);
  await getDb().delete(kosyncUsers).where(eq(kosyncUsers.id, user.id));
  return Response.json({ deleted: true });
}
