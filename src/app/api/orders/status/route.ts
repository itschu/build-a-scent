import type { NextRequest } from "next/server";
import { getActor } from "@/server/auth/session";
import { checkoutContextOrderId } from "@/server/checkout/context";
import { normalizeOrderNumber } from "@/server/checkout/order-number";
import { pollOrderStatus } from "@/server/checkout/status";

export async function GET(request: NextRequest) {
  const orderNumber = request.nextUrl.searchParams.get("order");
  if (!orderNumber) return Response.json({ error: "Missing order" }, { status: 400 });
  const status = await pollOrderStatus(normalizeOrderNumber(orderNumber), {
    actor: await getActor(),
    checkoutOrderId: await checkoutContextOrderId(),
  });
  if (!status) return Response.json({ error: "Order not found" }, { status: 404 });
  return Response.json({ status }, { headers: { "Cache-Control": "no-store" } });
}
