import { afterEach, describe, expect, it, vi } from "vitest";

const core = {
  NODE_ENV: "development",
  DATABASE_URL: "postgres://localhost/test",
  APP_URL: "http://localhost:3000",
  BETTER_AUTH_URL: "http://localhost:3000",
  BETTER_AUTH_SECRET: "x".repeat(32),
  CHECKOUT_CONTEXT_SECRET: "y".repeat(32),
};

async function loadEnv(vars: Record<string, string>) {
  vi.resetModules();
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, vars);
  return import("@/env");
}

const original = { ...process.env };
afterEach(() => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, original);
});

describe("env", () => {
  it("accepts core variables alone outside production", async () => {
    const { env } = await loadEnv(core);
    expect(env().DATABASE_URL).toBe(core.DATABASE_URL);
  });

  it("lists every missing core variable", async () => {
    const { env } = await loadEnv({ NODE_ENV: "development" });
    expect(() => env()).toThrow(/DATABASE_URL[\s\S]*BETTER_AUTH_SECRET/);
  });

  it("requires integration variables in production", async () => {
    const { env } = await loadEnv({ ...core, NODE_ENV: "production" });
    expect(() => env()).toThrow(/required in production[\s\S]*PAYSTACK_SECRET_KEY/);
  });

  it("fails loudly when an unconfigured feature is used", async () => {
    const { requireEnv } = await loadEnv(core);
    expect(() => requireEnv("RESEND_API_KEY")).toThrow(/RESEND_API_KEY is not configured/);
  });
});
