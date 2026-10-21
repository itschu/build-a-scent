import { beforeAll, describe, expect, it } from "vitest";

let storage: typeof import("@/server/storage");

beforeAll(async () => {
  Object.assign(process.env, {
    S3_ENDPOINT: "https://storage.example.com",
    S3_REGION: "auto",
    S3_BUCKET: "build-a-scent",
    S3_ACCESS_KEY_ID: "test-access-key",
    S3_SECRET_ACCESS_KEY: "test-secret-key",
    S3_PUBLIC_BASE_URL: "https://cdn.example.com/",
  });
  storage = await import("@/server/storage");
});

describe("createPresignedUpload", () => {
  it("signs a PUT pinned to the validated content type and length", async () => {
    const result = await storage.createPresignedUpload({
      prefix: "ingredients",
      contentType: "image/webp",
      contentLength: 1234,
    });
    expect(result.key).toMatch(/^ingredients\/[0-9a-f-]{36}\.webp$/);
    expect(result.publicUrl).toBe(`https://cdn.example.com/${result.key}`);

    const url = new URL(result.uploadUrl);
    expect(url.origin).toBe("https://storage.example.com");
    expect(url.pathname).toBe(`/build-a-scent/${result.key}`);
    expect(url.searchParams.get("X-Amz-Expires")).toBe("300");
    const signed = url.searchParams.get("X-Amz-SignedHeaders")?.split(";") ?? [];
    expect(signed).toEqual(expect.arrayContaining(["content-length", "content-type", "host"]));
  });

  it("rejects unsupported types and oversized files", async () => {
    await expect(
      storage.createPresignedUpload({ prefix: "products", contentType: "image/svg+xml", contentLength: 10 }),
    ).rejects.toThrow(/Unsupported/);
    await expect(
      storage.createPresignedUpload({
        prefix: "products",
        contentType: "image/png",
        contentLength: storage.MAX_UPLOAD_BYTES + 1,
      }),
    ).rejects.toThrow(/5 MB/);
  });
});
