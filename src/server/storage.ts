import "server-only";
import { randomUUID } from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requireEnv } from "@/env";

export const UPLOAD_PREFIXES = ["ingredients", "products", "bottles"] as const;
export type UploadPrefix = (typeof UPLOAD_PREFIXES)[number];

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const PRESIGN_TTL_SECONDS = 300;

let client: S3Client | undefined;

function s3(): S3Client {
  client ??= new S3Client({
    endpoint: requireEnv("S3_ENDPOINT"),
    region: requireEnv("S3_REGION"),
    forcePathStyle: true,
    credentials: {
      accessKeyId: requireEnv("S3_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("S3_SECRET_ACCESS_KEY"),
    },
  });
  return client;
}

export function publicUrlFor(key: string): string {
  return `${requireEnv("S3_PUBLIC_BASE_URL").replace(/\/$/, "")}/${key}`;
}

export class UploadValidationError extends Error {}

/**
 * Presigned PUT for a direct browser upload. The signature pins the content type and length,
 * so the client cannot upload something other than what was validated here.
 * Callers must authorize the actor (admin-only) before calling this.
 */
export async function createPresignedUpload(input: {
  prefix: UploadPrefix;
  contentType: string;
  contentLength: number;
}): Promise<{ uploadUrl: string; key: string; publicUrl: string }> {
  const extension = ALLOWED_TYPES[input.contentType];
  if (!extension) throw new UploadValidationError("Unsupported image type");
  if (!(input.contentLength > 0 && input.contentLength <= MAX_UPLOAD_BYTES)) {
    throw new UploadValidationError("Images must be 5 MB or smaller");
  }
  const key = `${input.prefix}/${randomUUID()}.${extension}`;
  const uploadUrl = await getSignedUrl(
    s3(),
    new PutObjectCommand({
      Bucket: requireEnv("S3_BUCKET"),
      Key: key,
      ContentType: input.contentType,
      ContentLength: input.contentLength,
    }),
    { expiresIn: PRESIGN_TTL_SECONDS, signableHeaders: new Set(["content-type"]) },
  );
  return { uploadUrl, key, publicUrl: publicUrlFor(key) };
}
