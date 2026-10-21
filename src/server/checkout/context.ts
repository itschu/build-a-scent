import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { env } from "@/env";

// Short-lived proof that this browser started checkout for an order (Tech Plan, Decision 10).
const COOKIE = "bas_checkout";
const TTL_SECONDS = 2 * 60 * 60;

function sign(payload: string): string {
  return createHmac("sha256", env().CHECKOUT_CONTEXT_SECRET).update(payload).digest("base64url");
}

export function encodeCheckoutContext(orderId: string, now = Date.now()): string {
  const payload = `${orderId}.${Math.floor(now / 1000) + TTL_SECONDS}`;
  return `${payload}.${sign(payload)}`;
}

/** Returns the order ID if the value is authentic and unexpired. */
export function decodeCheckoutContext(value: string | undefined, now = Date.now()): string | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [orderId, exp, signature] = parts;
  const expected = Buffer.from(sign(`${orderId}.${exp}`));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (Number(exp) * 1000 < now) return null;
  return orderId;
}

export async function setCheckoutContext(orderId: string) {
  (await cookies()).set(COOKIE, encodeCheckoutContext(orderId), {
    httpOnly: true,
    sameSite: "lax",
    secure: env().APP_URL.startsWith("https://"),
    path: "/",
    maxAge: TTL_SECONDS,
  });
}

export async function checkoutContextOrderId(): Promise<string | null> {
  return decodeCheckoutContext((await cookies()).get(COOKIE)?.value);
}
