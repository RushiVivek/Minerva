import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db/client";
import { kosyncProgress } from "@/db/schema";
import {
  authenticateKosync,
  kosyncError,
  kosyncJson,
  validKosyncDocument,
} from "@/lib/kosync";

const progressSchema = z.object({
  document: z.string(),
  progress: z.string(),
  percentage: z.number(),
  device: z.string().min(1),
  device_id: z.string().optional(),
});

export async function PUT(request: Request) {
  const user = await authenticateKosync(request);
  if (!user) return kosyncError("Unauthorized", 2001, 401);
  const body = await kosyncJson(request);
  const parsed = progressSchema.safeParse(body);
  if (
    !parsed.success ||
    !validKosyncDocument(parsed.data.document) ||
    !Number.isFinite(parsed.data.percentage)
  ) {
    return kosyncError(
      validKosyncDocument((body as { document?: unknown })?.document)
        ? "Invalid request"
        : "Field 'document' not provided.",
      validKosyncDocument((body as { document?: unknown })?.document) ? 2003 : 2004,
      403,
    );
  }

  const timestamp = Math.floor(Date.now() / 1000);
  await getDb()
    .insert(kosyncProgress)
    .values({
      userId: user.id,
      document: parsed.data.document,
      progress: parsed.data.progress,
      percentage: String(parsed.data.percentage),
      device: parsed.data.device,
      deviceId: parsed.data.device_id ?? null,
      timestamp,
    })
    .onConflictDoUpdate({
      target: [kosyncProgress.userId, kosyncProgress.document],
      set: {
        progress: parsed.data.progress,
        percentage: String(parsed.data.percentage),
        device: parsed.data.device,
        deviceId: parsed.data.device_id ?? null,
        timestamp,
      },
    });

  return Response.json({ document: parsed.data.document, timestamp });
}
