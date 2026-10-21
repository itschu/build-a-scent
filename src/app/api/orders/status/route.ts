import type { NextRequest } from "next/server";
import { getActor } from "@/server/auth/session";
import { checkoutContextOrderId } from "@/server/checkout/context";
import { normalizeOrderNumber } from "@/server/checkout/order-number";
import { pollOrderStatus } from "@/server/checkout/status";
import { checkLimits, clientIp, LIMITS, tooManyRequests } from "@/server/rate-limit";

export async function GET(request: NextRequest) {
  const orderNumber = request.nextUrl.searchParams.get("order");
  if (!orderNumber) return Response.json({ error: "Missing order" }, { status: 400 });
  const normalized = normalizeOrderNumber(orderNumber);
  // Polling can trigger a gateway call, so it is limited before anything else runs.
  const limited = await checkLimits([
    { key: `status:ip:${clientIp(request.headers)}`, ...LIMITS.statusPollPerIp },
    { key: `status:order:${normalized}`, ...LIMITS.statusPollPerOrder },
  ]);
  if (!limited.allowed) return tooManyRequests(limited);
  const status = await pollOrderStatus(normalized, {
    actor: await getActor(),
    checkoutOrderId: await checkoutContextOrderId(),
  });
  if (!status) return Response.json({ error: "Order not found" }, { status: 404 });
  return Response.json({ status }, { headers: { "Cache-Control": "no-store" } });
}
