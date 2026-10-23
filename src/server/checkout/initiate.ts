import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { env } from "@/env";
import { deliveryWindow } from "@/lib/delivery-estimate";
import { formatNaira } from "@/lib/money";
import { CHECKOUT_PAUSED_DEFAULT, minOrderShortfallKobo, shippingFeeKobo } from "@/lib/order-rules";
import { checkoutRequestSchema, type CheckoutRequest } from "@/lib/validation/checkout";
import { getDb, schema } from "@/server/db";
import { ValidationError, type Actor } from "@/server/dal/actor";
import { getGateway } from "@/server/payments";
import { GatewayError } from "@/server/payments/types";
import { getSettings } from "@/server/settings";
import { newOrderNumber } from "./order-number";
import { revalidateCart, type LineIssue } from "./revalidate";
import { quoteShipping } from "./shipping";

export type InitiateResult =
  | { kind: "changed"; issues: LineIssue[] }
  | { kind: "ready"; orderId: string; orderNumber: string; paymentUrl: string };

/**
 * Checkout initiation: strict revalidation, order + items (+ low-stock reservations) in one
 * transaction, then gateway initialisation. Nothing is created if anything changed.
 */
export async function initiateCheckout(actor: Actor, request: CheckoutRequest): Promise<InitiateResult> {
  const { lines, delivery, gateway } = checkoutRequestSchema.parse(request);
  const settings = await getSettings();
  if (!settings.checkout_enabled) throw new ValidationError(settings.checkout_paused_message || CHECKOUT_PAUSED_DEFAULT);
  const db = getDb();

  const quote = await quoteShipping(delivery.state);
  if (!quote) throw new ValidationError(`We don't deliver to ${delivery.state} yet.`);

  const created = await db.transaction(async (tx) => {
    const { lines: priced, issues } = await revalidateCart(tx, lines, settings);
    if (issues.length > 0) return { kind: "changed" as const, issues };

    const subtotalKobo = priced.reduce((sum, l) => sum + l.unitPriceKobo * l.quantity, 0);
    if (minOrderShortfallKobo(subtotalKobo, settings.min_order_kobo) > 0) {
      throw new ValidationError(`The minimum order is ${formatNaira(settings.min_order_kobo)} before shipping.`);
    }
    const feeKobo = shippingFeeKobo(quote.feeKobo, subtotalKobo, settings.free_shipping_threshold_kobo);
    const eta = deliveryWindow(settings.production_lead_days, quote);

    let order: { id: string; orderNumber: string; paymentReference: string | null } | undefined;
    for (let attempt = 0; attempt < 5 && !order; attempt++) {
      const orderNumber = newOrderNumber();
      [order] = await tx
        .insert(schema.orders)
        .values({
          orderNumber,
          userId: actor.kind === "user" ? actor.userId : null,
          email: delivery.email,
          paymentGateway: gateway,
          paymentReference: `${orderNumber}-${randomBytes(3).toString("hex")}`,
          subtotalKobo,
          shippingFeeKobo: feeKobo,
          totalKobo: subtotalKobo + feeKobo,
          deliveryAddress: {
            fullName: delivery.fullName,
            phone: delivery.phone,
            address: delivery.address,
            city: delivery.city,
            state: delivery.state,
          },
          shippingZoneId: quote.zoneId,
          etaFrom: eta.from,
          etaTo: eta.to,
        })
        .onConflictDoNothing({ target: schema.orders.orderNumber })
        .returning({
          id: schema.orders.id,
          orderNumber: schema.orders.orderNumber,
          paymentReference: schema.orders.paymentReference,
        });
    }
    if (!order) throw new Error("Could not allocate an order number");

    await tx.insert(schema.orderItems).values(
      priced.map((l) => ({
        orderId: order.id,
        itemType: l.itemType,
        referenceId: l.referenceId,
        itemSnapshot: l.snapshot as unknown as Record<string, unknown>,
        quantity: l.quantity,
        unitPriceKobo: l.unitPriceKobo,
        lineTotalKobo: l.unitPriceKobo * l.quantity,
      })),
    );

    // Low-stock variants are held until payment completes (Tech Plan, Decision 16).
    const expiresAt = new Date(Date.now() + settings.reservation_ttl_minutes * 60_000);
    const holds = priced.filter(
      (l) => l.variantId && l.availableStock !== undefined && l.availableStock <= settings.low_stock_reserve_threshold,
    );
    if (holds.length > 0) {
      await tx.insert(schema.inventoryReservations).values(
        holds.map((l) => ({ productVariantId: l.variantId!, orderId: order.id, quantity: l.quantity, expiresAt })),
      );
    }

    return { kind: "created" as const, order, totalKobo: subtotalKobo + feeKobo };
  });

  if (created.kind === "changed") return created;

  const { order } = created;
  try {
    const { paymentUrl } = await getGateway(gateway).initialize({
      reference: order.paymentReference!,
      amountKobo: created.totalKobo,
      email: delivery.email,
      name: delivery.fullName,
      phone: delivery.phone,
      orderNumber: order.orderNumber,
      callbackUrl: `${env().APP_URL}/checkout/processing?order=${order.orderNumber}`,
    });
    return { kind: "ready", orderId: order.id, orderNumber: order.orderNumber, paymentUrl };
  } catch (error) {
    // The customer never reached the gateway, so the order can't be paid: cancel it and free any hold.
    await db.transaction(async (tx) => {
      await tx
        .update(schema.orders)
        .set({ status: "cancelled", attentionReason: "Gateway initialisation failed" })
        .where(and(eq(schema.orders.id, order.id), eq(schema.orders.status, "pending_payment")));
      await tx
        .update(schema.inventoryReservations)
        .set({ status: "released" })
        .where(and(eq(schema.inventoryReservations.orderId, order.id), eq(schema.inventoryReservations.status, "active")));
    });
    if (error instanceof GatewayError) {
      console.error(error.message);
      const other = gateway === "paystack" ? "Flutterwave" : "Paystack";
      throw new ValidationError(`We couldn't start the payment right now. Please try again or choose ${other}.`);
    }
    throw error;
  }
}
