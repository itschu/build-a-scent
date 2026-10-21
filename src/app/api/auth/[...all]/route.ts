import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/server/auth";
import { checkLimits, clientIp, LIMITS, tooManyRequests } from "@/server/rate-limit";

// Credential endpoints get our Postgres-backed limit on top of Better Auth's built-in one,
// which is per instance and in memory.
const LIMITED_PATHS = ["/sign-in/email", "/sign-up/email", "/request-password-reset", "/reset-password"];

export async function GET(request: Request) {
  return toNextJsHandler(getAuth()).GET(request);
}

export async function POST(request: Request) {
  const path = new URL(request.url).pathname.replace(/^\/api\/auth/, "");
  if (LIMITED_PATHS.includes(path)) {
    const limited = await checkLimits([{ key: `auth:${path}:ip:${clientIp(request.headers)}`, ...LIMITS.authPerIp }]);
    if (!limited.allowed) return tooManyRequests(limited, "Too many attempts. Please wait a few minutes and try again.");
  }
  return toNextJsHandler(getAuth()).POST(request);
}
