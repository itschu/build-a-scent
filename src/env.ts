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
});

const features = z.object({
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  PAYSTACK_SECRET_KEY: z.string().min(1),
  FLUTTERWAVE_SECRET_KEY: z.string().min(1),
  FLUTTERWAVE_WEBHOOK_HASH: z.string().min(1),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_USER: z.string().min(1),
  SMTP_PASS: z.string().min(1),
  EMAIL_FROM: z.string().min(1),
  S3_ENDPOINT: z.url(),
  S3_REGION: z.string().min(1).default("auto"),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_PUBLIC_BASE_URL: z.url(),
});

const schema = core.extend(features.partial().shape);
export type Env = z.infer<typeof schema>;
type FeatureKey = keyof z.infer<typeof features>;

let cached: Env | undefined;

function formatIssues(error: z.ZodError): string {
  return error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
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
