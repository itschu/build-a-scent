import "server-only";
import { randomUUID } from "node:crypto";
import { betterAuth, type BetterAuthPlugin } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { env } from "@/env";
import { schema, type Db } from "@/server/db";
import { sendEmail } from "@/server/email";
import { ensureProfile } from "@/server/dal/profiles";

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
        // Not awaited, so response time doesn't reveal whether an account exists.
        void sendEmail({
          dedupeKey: `reset_password:${user.id}:${randomUUID()}`,
          to: user.email,
          template: "reset_password",
          payload: { name: user.name, url },
        });
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
          after: async (user) => {
            await ensureProfile(db, { userId: user.id, fullName: user.name });
          },
        },
      },
    },
    plugins,
  });
}

export type Auth = ReturnType<typeof createAuth>;
