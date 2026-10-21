import { eq, sql } from "drizzle-orm";
import * as schema from "../src/server/db/schema";
import type { ScriptDb } from "./db";

export class UserNotFoundError extends Error {}

/** Promotes an existing account to admin. Idempotent; the user must have signed up first. */
export async function promoteToAdmin(db: ScriptDb, email: string) {
  const [user] = await db
    .update(schema.users)
    .set({ role: "admin" })
    .where(eq(sql`lower(${schema.users.email})`, email.trim().toLowerCase()))
    .returning({ id: schema.users.id, email: schema.users.email });
  if (!user) throw new UserNotFoundError(`No account found for ${email}. Sign up first.`);
  return user;
}
