import "server-only";
import { sql } from "drizzle-orm";
import { getDb, schema } from "@/server/db";

export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterSeconds: number };

/**
 * Fixed-window counter in Postgres (`rate_limits`): one atomic upsert per call, so it works
 * across app instances without extra infrastructure. Old windows are pruned by the jobs runner.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const t = schema.rateLimits;
  const result = await getDb().execute<{ count: number; window_start: Date }>(sql`
    insert into ${t} (key, window_start, count) values (${key}, now(), 1)
    on conflict (key) do update set
      count = case when ${t.windowStart} <= now() - make_interval(secs => ${windowSeconds}) then 1 else ${t.count} + 1 end,
      window_start = case when ${t.windowStart} <= now() - make_interval(secs => ${windowSeconds}) then now() else ${t.windowStart} end
    returning count, window_start`);
  const row = result.rows[0];
  const count = Number(row.count);
  const windowEnds = new Date(row.window_start).getTime() + windowSeconds * 1000;
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds: Math.max(1, Math.ceil((windowEnds - Date.now()) / 1000)),
  };
}

/** Client IP from the proxy headers Railway sets; falls back to a shared bucket. */
export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip")?.trim() || "unknown";
}

export const LIMITS = {
  orderLookupPerIp: { limit: 10, windowSeconds: 600 },
  orderLookupPerOrder: { limit: 5, windowSeconds: 600 },
  statusPollPerIp: { limit: 120, windowSeconds: 60 },
  statusPollPerOrder: { limit: 60, windowSeconds: 60 },
  checkoutPerIp: { limit: 10, windowSeconds: 600 },
  authPerIp: { limit: 10, windowSeconds: 300 },
} as const;

/** Checks several limits; the first one exceeded wins. */
export async function checkLimits(
  checks: Array<{ key: string; limit: number; windowSeconds: number }>,
): Promise<RateLimitResult> {
  let last: RateLimitResult = { allowed: true, remaining: Number.POSITIVE_INFINITY, retryAfterSeconds: 0 };
  for (const c of checks) {
    last = await rateLimit(c.key, c.limit, c.windowSeconds);
    if (!last.allowed) return last;
  }
  return last;
}

export function tooManyRequests(result: RateLimitResult, message = "Too many requests. Please wait a moment and try again.") {
  return Response.json({ error: message }, { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } });
}
