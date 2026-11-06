import { and, eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { kosyncProgress } from "@/db/schema";
import { authenticateKosync, kosyncError, validKosyncDocument } from "@/lib/kosync";

export async function GET(
  request: Request,
  context: { params: Promise<{ document: string }> },
) {
  const user = await authenticateKosync(request);
  if (!user) return kosyncError("Unauthorized", 2001, 401);
  const { document } = await context.params;
  if (!validKosyncDocument(document)) {
    return kosyncError("Field 'document' not provided.", 2004, 403);
  }
  const [progress] = await getDb()
    .select()
    .from(kosyncProgress)
    .where(and(eq(kosyncProgress.userId, user.id), eq(kosyncProgress.document, document)))
    .limit(1);
  if (!progress) return Response.json({});
  return Response.json({
    document: progress.document,
    percentage: Number(progress.percentage),
    progress: progress.progress,
    device: progress.device,
    ...(progress.deviceId ? { device_id: progress.deviceId } : {}),
    timestamp: progress.timestamp,
  });
}
