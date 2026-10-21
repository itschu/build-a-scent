import { z } from "zod";
import { normalizeOrderNumber } from "@/server/checkout/order-number";
import { lookupOrder } from "@/server/dal/orders";
import { checkLimits, clientIp, LIMITS, tooManyRequests } from "@/server/rate-limit";

const lookupSchema = z.object({ orderNumber: z.string().trim().min(4).max(20), email: z.email().trim() });

export async function POST(request: Request) {
  const parsed = lookupSchema.safeParse(await request.json().catch(() => null));
  // One generic message whatever was wrong, so lookups can't probe for valid order numbers.
  const notFound = Response.json({ error: "We couldn't find that order. Check the order number and email." }, { status: 404 });
  if (!parsed.success) return notFound;
  const orderNumber = normalizeOrderNumber(parsed.data.orderNumber);
  // Per IP and per order number, so neither guessing emails nor guessing numbers scales.
  const limited = await checkLimits([
    { key: `lookup:ip:${clientIp(request.headers)}`, ...LIMITS.orderLookupPerIp },
    { key: `lookup:order:${orderNumber}`, ...LIMITS.orderLookupPerOrder },
  ]);
  if (!limited.allowed) return tooManyRequests(limited, "Too many lookups. Please wait a few minutes and try again.");
  const order = await lookupOrder(orderNumber, parsed.data.email);
  if (!order) return notFound;
  return Response.json({ order }, { headers: { "Cache-Control": "no-store" } });
}
