import "server-only";
import { randomUUID } from "node:crypto";
import { betterAuth, type BetterAuthPlugin } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { and, eq } from "drizzle-orm";
import { env } from "@/env";
import { schema, type Db } from "@/server/db";
import { sendEmail } from "@/server/email";
import { ensureProfile } from "@/server/dal/profiles";
import { getSettings } from "@/server/settings";

export const ACCOUNT_SUSPENDED_MESSAGE = "This account has been suspended. Please contact support.";
export const SIGNUPS_PAUSED_MESSAGE = "New sign-ups are paused right now. Please check back soon.";

export const MIN_PASSWORD_LENGTH = 8;

/** Builds the Better Auth instance. Tests pass their own plugins (no Next.js cookie plugin). */
export function createAuth(db: Db, plugins: BetterAuthPlugin[] = []) {
  const e = env();
  const google =
    e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET
      ? { google: { clientId: e.GOOGLE_CLIENT_ID, clientSecret: e.GOOGLE_CLIENT_SECRET } }
      : undefined;

  return betterAuth({
    baseURL: e.BETTER_AUTH_URL,
    secret: e.BETTER_AUTH_SECRET,
    trustedOrigins: [e.APP_URL],
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verifications,
      },
    }),
    advanced: { database: { generateId: "uuid" } },
    user: {
      additionalFields: {
        // `input: false` stops sign-up and update-user requests from setting the role.
        role: { type: "string", required: false, defaultValue: "user", input: false },
      },
      changeEmail: { enabled: true },
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        // Not awaited, so response time doesn't reveal whether an account exists. Accounts
        // without a password yet (invited by an admin, or Google-only) get "set" wording.
        void (async () => {
          const [credential] = await db
            .select({ id: schema.accounts.id })
            .from(schema.accounts)
            .where(and(eq(schema.accounts.userId, user.id), eq(schema.accounts.providerId, "credential")));
          const template = credential ? "reset_password" : "set_password";
          await sendEmail({ dedupeKey: `${template}:${user.id}:${randomUUID()}`, to: user.email, template, payload: { name: user.name, url } });
        })();
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        void sendEmail({
          dedupeKey: `verify_email:${user.id}:${randomUUID()}`,
          to: user.email,
          template: "verify_email",
          payload: { name: user.name, url },
        });
      },
    },
    socialProviders: google,
    databaseHooks: {
      user: {
        create: {
          // Admin-invited accounts are inserted directly, so this only gates self sign-up
          // (email or Google).
          before: async () => {
            if (!(await getSettings()).signups_enabled) throw new APIError("FORBIDDEN", { message: SIGNUPS_PAUSED_MESSAGE });
          },
          after: async (user) => {
            await ensureProfile(db, { userId: user.id, fullName: user.name });
          },
        },
      },
      session: {
        create: {
          // Blocked or deleted accounts can't start a session (blocking also ends existing ones).
          before: async (session) => {
            const [user] = await db
              .select({ bannedAt: schema.users.bannedAt })
              .from(schema.users)
              .where(eq(schema.users.id, session.userId));
            if (user?.bannedAt) throw new APIError("FORBIDDEN", { message: ACCOUNT_SUSPENDED_MESSAGE });
          },
        },
      },
    },
    plugins,
  });
}

export type Auth = ReturnType<typeof createAuth>;
