import { randomUUID } from "node:crypto";
import type { UserRole } from "@/lib/domain";
import type { SignedInActor } from "@/server/dal/actor";
import type { ScriptDb } from "../../scripts/db";
import * as schema from "../../src/server/db/schema";

export async function createUser(
  db: ScriptDb,
  overrides: Partial<{ email: string; name: string; role: UserRole; emailVerified: boolean }> = {},
) {
  const [user] = await db
    .insert(schema.users)
    .values({
      name: overrides.name ?? "Test User",
      email: overrides.email ?? `user-${randomUUID()}@example.com`,
      role: overrides.role ?? "user",
      emailVerified: overrides.emailVerified ?? true,
    })
    .returning();
  await db.insert(schema.profiles).values({ userId: user.id, fullName: user.name }).onConflictDoNothing();
  return user;
}

export function actorFor(user: { id: string; role: UserRole; emailVerified: boolean }): SignedInActor {
  return { kind: "user", userId: user.id, role: user.role, emailVerified: user.emailVerified };
}
