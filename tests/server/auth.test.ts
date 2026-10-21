import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAuth } from "@/server/auth/config";
import { getDb } from "@/server/db";
import { freshTestDatabase, testDatabaseUrl } from "../support/db";

type Connection = Awaited<ReturnType<typeof freshTestDatabase>>;

describe.skipIf(!testDatabaseUrl)("Better Auth integration", () => {
  let conn: Connection;
  let auth: ReturnType<typeof createAuth>;

  beforeAll(async () => {
    conn = await freshTestDatabase();
    auth = createAuth(getDb());
  });

  afterAll(async () => {
    await conn?.close();
  });

  async function signUp(email: string, extra: Record<string, unknown> = {}) {
    return auth.api.signUpEmail({ body: { name: "Adaeze Okonkwo", email, password: "correct horse", ...extra } });
  }

  it("creates a user with role 'user' and a matching profile", async () => {
    const result = await signUp("adaeze@example.com");
    const [user] = await conn.db.select().from(conn.schema.users).where(eq(conn.schema.users.id, result.user.id));
    expect(user.role).toBe("user");
    expect(user.emailVerified).toBe(false);
    const [profile] = await conn.db
      .select()
      .from(conn.schema.profiles)
      .where(eq(conn.schema.profiles.userId, user.id));
    expect(profile.fullName).toBe("Adaeze Okonkwo");
  });

  it("never lets a sign-up request choose its role", async () => {
    const attempt = signUp("sneaky@example.com", { role: "admin" });
    const outcome = await attempt.then(
      (r) => ({ ok: true as const, id: r.user.id }),
      () => ({ ok: false as const }),
    );
    if (outcome.ok) {
      const [user] = await conn.db.select().from(conn.schema.users).where(eq(conn.schema.users.id, outcome.id));
      expect(user.role).toBe("user");
    } else {
      const rows = await conn.db.select().from(conn.schema.users).where(eq(conn.schema.users.email, "sneaky@example.com"));
      expect(rows).toHaveLength(0);
    }
  });

  it("queues a verification email on sign-up", async () => {
    await signUp("verify-me@example.com");
    await new Promise((r) => setTimeout(r, 100));
    const emails = await conn.db
      .select()
      .from(conn.schema.emailOutbox)
      .where(eq(conn.schema.emailOutbox.toEmail, "verify-me@example.com"));
    expect(emails.map((e) => e.template)).toEqual(["verify_email"]);
    expect(String(emails[0].payload.url)).toContain("/api/auth/verify-email?token=");
  });

  it("reads the role from the database on every request", async () => {
    await signUp("future-admin@example.com");
    const response = await auth.api.signInEmail({
      body: { email: "future-admin@example.com", password: "correct horse" },
      asResponse: true,
    });
    const cookie = response.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
    const headers = new Headers({ cookie });

    const before = await auth.api.getSession({ headers });
    expect((before?.user as { role?: string }).role).toBe("user");

    await conn.db
      .update(conn.schema.users)
      .set({ role: "admin" })
      .where(eq(conn.schema.users.email, "future-admin@example.com"));
    const after = await auth.api.getSession({ headers });
    expect((after?.user as { role?: string }).role).toBe("admin");
  });
});
