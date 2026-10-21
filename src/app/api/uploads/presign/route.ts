import { z } from "zod";
import { getActor } from "@/server/auth/session";
import { isAdmin } from "@/server/dal/actor";
import { createPresignedUpload, UPLOAD_PREFIXES, UploadValidationError } from "@/server/storage";

const presignSchema = z.object({
  prefix: z.enum(UPLOAD_PREFIXES),
  contentType: z.string(),
  contentLength: z.number().int().positive(),
});

/** Admin-only: a short-lived URL to upload one image straight to object storage. */
export async function POST(request: Request) {
  if (!isAdmin(await getActor())) return Response.json({ error: "Admin access required" }, { status: 403 });
  const parsed = presignSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid upload request" }, { status: 400 });
  try {
    return Response.json(await createPresignedUpload(parsed.data));
  } catch (error) {
    if (error instanceof UploadValidationError) return Response.json({ error: error.message }, { status: 422 });
    console.error(error);
    return Response.json({ error: "Image storage isn't available. Paste an image URL instead." }, { status: 503 });
  }
}
