import { z } from "zod";
import { getActor } from "@/server/auth/session";
import { isAdmin } from "@/server/dal/actor";
import { saveUpload, UPLOAD_PREFIXES, UploadValidationError } from "@/server/storage";

const prefixSchema = z.enum(UPLOAD_PREFIXES);

/** Admin-only: stores one image (multipart field `file`) and returns its public URL. */
export async function POST(request: Request) {
  if (!isAdmin(await getActor())) return Response.json({ error: "Admin access required" }, { status: 403 });
  const form = await request.formData().catch(() => null);
  const prefix = prefixSchema.safeParse(form?.get("prefix"));
  const file = form?.get("file");
  if (!prefix.success || !(file instanceof File)) return Response.json({ error: "Invalid upload request" }, { status: 400 });
  try {
    return Response.json(await saveUpload({ prefix: prefix.data, file }));
  } catch (error) {
    if (error instanceof UploadValidationError) return Response.json({ error: error.message }, { status: 422 });
    console.error(error);
    return Response.json({ error: "Image storage isn't available. Paste an image URL instead." }, { status: 503 });
  }
}
