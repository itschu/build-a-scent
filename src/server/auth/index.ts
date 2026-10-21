import "server-only";
import { nextCookies } from "better-auth/next-js";
import { getDb } from "@/server/db";
import { createAuth, type Auth } from "./config";

const globalForAuth = globalThis as unknown as { auth?: Auth };

/** The app's Better Auth instance; `nextCookies` lets Server Actions set auth cookies. */
export function getAuth(): Auth {
  globalForAuth.auth ??= createAuth(getDb(), [nextCookies()]);
  return globalForAuth.auth;
}
