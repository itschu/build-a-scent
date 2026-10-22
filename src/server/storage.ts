import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/env";

// Uploaded images live on disk under UPLOADS_DIR (a Railway volume in production) and are
// served back by the app at /uploads/<key>.

export const UPLOAD_PREFIXES = ["ingredients", "products", "bottles"] as const;
export type UploadPrefix = (typeof UPLOAD_PREFIXES)[number];

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};
const CONTENT_TYPES = Object.fromEntries(Object.entries(ALLOWED_TYPES).map(([type, ext]) => [ext, type]));

// Keys are always generated here, so anything else (including "../") is rejected when serving.
const KEY_PATTERN = new RegExp(
  `^(?:${UPLOAD_PREFIXES.join("|")})/[0-9a-f-]{36}\\.(${Object.values(ALLOWED_TYPES).join("|")})$`,
);

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

function uploadsDir(): string {
  return path.resolve(/* turbopackIgnore: true */ env().UPLOADS_DIR ?? "uploads");
}

export function publicUrlFor(key: string): string {
  return `${env().APP_URL.replace(/\/$/, "")}/uploads/${key}`;
}

export class UploadValidationError extends Error {}

/**
 * Stores one uploaded image and returns its public URL.
 * Callers must authorize the actor (admin-only) before calling this.
 */
export async function saveUpload(input: {
  prefix: UploadPrefix;
  file: Blob;
}): Promise<{ key: string; publicUrl: string }> {
  const extension = ALLOWED_TYPES[input.file.type];
  if (!extension) throw new UploadValidationError("Unsupported image type");
  if (!(input.file.size > 0 && input.file.size <= MAX_UPLOAD_BYTES)) {
    throw new UploadValidationError("Images must be 5 MB or smaller");
  }
  const key = `${input.prefix}/${randomUUID()}.${extension}`;
  const target = path.join(uploadsDir(), key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, Buffer.from(await input.file.arrayBuffer()), { flag: "wx" });
  return { key, publicUrl: publicUrlFor(key) };
}

/** Reads a stored image, or null when the key is malformed or the file doesn't exist. */
export async function readUpload(key: string): Promise<{ body: Buffer; contentType: string } | null> {
  const match = KEY_PATTERN.exec(key);
  if (!match) return null;
  try {
    return { body: await readFile(path.join(uploadsDir(), key)), contentType: CONTENT_TYPES[match[1]] };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
