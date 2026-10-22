import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let storage: typeof import("@/server/storage");
let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "bas-uploads-"));
  Object.assign(process.env, {
    DATABASE_URL: "postgres://localhost/test",
    APP_URL: "http://localhost:3000/",
    BETTER_AUTH_URL: "http://localhost:3000",
    BETTER_AUTH_SECRET: "x".repeat(32),
    CHECKOUT_CONTEXT_SECRET: "y".repeat(32),
    UPLOADS_DIR: dir,
  });
  storage = await import("@/server/storage");
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

const image = (type: string, size = 4) => new Blob([new Uint8Array(size)], { type });

describe("saveUpload", () => {
  it("stores the image under a generated key and serves it back", async () => {
    const result = await storage.saveUpload({ prefix: "ingredients", file: image("image/webp") });
    expect(result.key).toMatch(/^ingredients\/[0-9a-f-]{36}\.webp$/);
    expect(result.publicUrl).toBe(`http://localhost:3000/uploads/${result.key}`);
    expect((await readFile(path.join(dir, result.key))).length).toBe(4);

    const served = await storage.readUpload(result.key);
    expect(served?.contentType).toBe("image/webp");
    expect(served?.body.length).toBe(4);
  });

  it("rejects unsupported types and oversized files", async () => {
    await expect(storage.saveUpload({ prefix: "products", file: image("image/svg+xml") })).rejects.toThrow(/Unsupported/);
    await expect(
      storage.saveUpload({ prefix: "products", file: image("image/png", storage.MAX_UPLOAD_BYTES + 1) }),
    ).rejects.toThrow(/5 MB/);
  });
});

describe("readUpload", () => {
  it("only serves keys the app could have generated", async () => {
    expect(await storage.readUpload("../../etc/passwd")).toBeNull();
    expect(await storage.readUpload("products/../../secret.png")).toBeNull();
    expect(await storage.readUpload("products/00000000-0000-0000-0000-000000000000.png")).toBeNull();
  });
});
