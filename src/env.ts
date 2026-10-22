// Server environment, validated with Zod. Core variables are always required; feature
// variables are required in production and optional elsewhere so local development can
// start before every integration is configured.
import { z } from "zod";

const core = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.url(),
  APP_URL: z.url(),
  BETTER_AUTH_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  CHECKOUT_CONTEXT_SECRET: z.string().min(32),
  // "fake" swaps Paystack/Flutterwave for a local simulator (see src/server/payments/fake.ts).
  PAYMENTS_MODE: z.enum(["live", "fake"]).default("live"),
});

const features = z.object({
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  PAYSTACK_SECRET_KEY: z.string().min(1),
  FLUTTERWAVE_SECRET_KEY: z.string().min(1),
  FLUTTERWAVE_WEBHOOK_HASH: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  // Must use a domain verified in Resend, e.g. "Build a Scent <hello@yourdomain.com>".
  EMAIL_FROM: z.string().min(1),
  // Where uploaded images are stored: the mount path of the Railway volume.
  UPLOADS_DIR: z.string().min(1),
});

const schema = core.extend(features.partial().shape);
export type Env = z.infer<typeof schema>;
type FeatureKey = keyof z.infer<typeof features>;

let cached: Env | undefined;

function formatIssues(error: z.ZodError): string {
  return error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
}

function isLocalUrl(url: string): boolean {
  const { hostname } = new URL(url);
  return hostname === "localhost" || hostname === "127.0.0.1";
}

/** Parses and caches the environment. Throws a readable error listing every problem. */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment variables:\n${formatIssues(parsed.error)}`);
  }
  // `next build` also runs with NODE_ENV=production but may not have runtime secrets;
  // the server re-validates at boot (instrumentation), which is where this must hold.
  const isBuild = process.env.NEXT_PHASE === "phase-production-build";
  if (parsed.data.NODE_ENV === "production" && !isBuild) {
    const strict = features.safeParse(process.env);
    if (!strict.success) {
      throw new Error(
        `Missing environment variables required in production:\n${formatIssues(strict.error)}`,
      );
    }
  }
  if (parsed.data.PAYMENTS_MODE === "fake" && !isLocalUrl(parsed.data.APP_URL)) {
    throw new Error("PAYMENTS_MODE=fake is only allowed when APP_URL is localhost");
  }
  cached = parsed.data;
  return cached;
}

/** Returns a feature variable, failing loudly if the feature is used without configuration. */
export function requireEnv<K extends FeatureKey>(key: K): NonNullable<Env[K]> {
  const value = env()[key];
  if (value === undefined || value === "") {
    throw new Error(`${key} is not configured`);
  }
  return value as NonNullable<Env[K]>;
}
