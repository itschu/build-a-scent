import "server-only";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { env } from "@/env";
import type { OrderStatus } from "@/lib/domain";
import { formatWindow } from "@/lib/delivery-estimate";
import { buyerView, type ItemSnapshot, type MarketplaceSnapshot } from "@/lib/order-snapshot";
import { getDb, schema, type Tx } from "@/server/db";
import { deliverEmails, queueEmail } from "@/server/email";
import type { Verification } from "./types";

export type ApplySource = "webhook" | "return" | "admin" | "job";

export type ApplyOutcome =
  | "paid"
  | "failed"
  | "already_processed"
  | "pending"
  | "amount_mismatch"
  | "unknown_order";

/** States a verified success may move out of. A success always wins: money was taken. */
const PAYABLE: OrderStatus[] = ["pending_payment", "verifying_payment", "expired", "payment_failed"];
/** States a verified failure may move out of. */
const FAILABLE: OrderStatus[] = ["pending_payment", "verifying_payment"];

/**
 * Applies a gateway-verified result to an order (Tech Plan, Decision 6). Every caller (webhook,
 * processing page, admin re-verify, background job) goes through here, so transitions are
 * identical, forward-only and idempotent: the order row is locked, and repeated calls after
 * the first find nothing left to do.
 */
export async function applyVerifiedPayment(
  reference: string,
  verification: Verification,
  source: ApplySource,
): Promise<ApplyOutcome> {
  const emailIds: Array<string | null> = [];
  const outcome = await getDb().transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.paymentReference, reference))
      .for("update");
    if (!order) return "unknown_order" as const;

    await tx
      .update(schema.orders)
      .set({
        lastGatewayStatus: verification.gatewayStatus,
        ...(source !== "webhook" && { lastVerifyAt: new Date(), verifyAttempts: order.verifyAttempts + 1 }),
      })
      .where(eq(schema.orders.id, order.id));

    if (verification.status === "success") {
      if (verification.amountKobo !== order.totalKobo || verification.currency !== order.currency) {
        await tx
          .update(schema.orders)
          .set({
            needsAttention: true,
            attentionReason: `Gateway reported ${verification.currency ?? "?"} ${verification.amountKobo ?? "?"} kobo; order total is NGN ${order.totalKobo} kobo.`,
          })
          .where(eq(schema.orders.id, order.id));
        return "amount_mismatch" as const;
      }
      if (!PAYABLE.includes(order.status)) return "already_processed" as const;
      emailIds.push(...(await markPaid(tx, order)));
      return "paid" as const;
    }

    if (verification.status === "failed") {
      if (!FAILABLE.includes(order.status)) return "already_processed" as const;
      await tx.update(schema.orders).set({ status: "payment_failed" }).where(eq(schema.orders.id, order.id));
      await releaseReservations(tx, order.id);
      return "failed" as const;
    }

    return "pending" as const;
  });

  await deliverEmails(emailIds);
  return outcome;
}

export async function releaseReservations(tx: Tx, orderId: string) {
  await tx
    .update(schema.inventoryReservations)
    .set({ status: "released" })
    .where(and(eq(schema.inventoryReservations.orderId, orderId), eq(schema.inventoryReservations.status, "active")));
}

async function markPaid(tx: Tx, order: typeof schema.orders.$inferSelect): Promise<Array<string | null>> {
  const items = await tx.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, order.id));
  const attention: string[] = [];

  // Stock: consume this order's holds and deduct stock, never below zero.
  await tx
    .update(schema.inventoryReservations)
    .set({ status: "consumed" })
    .where(
      and(
        eq(schema.inventoryReservations.orderId, order.id),
        inArray(schema.inventoryReservations.status, ["active"]),
      ),
    );
  for (const item of items.filter((i) => i.itemType === "standard_product")) {
    const deducted = await tx
      .update(schema.productVariants)
      .set({ stockQty: sql`${schema.productVariants.stockQty} - ${item.quantity}` })
      .where(and(eq(schema.productVariants.id, item.referenceId), gte(schema.productVariants.stockQty, item.quantity)))
      .returning({ id: schema.productVariants.id });
    if (deducted.length === 0) {
      attention.push(`Paid but out of stock: ${(item.itemSnapshot as ItemSnapshot).name} × ${item.quantity}`);
    }
  }

  // Seller earnings start as pending; they become available when the order is fulfilled.
  const credits = items
    .filter((i) => i.itemType === "marketplace_listing")
    .map((i) => {
      const snapshot = i.itemSnapshot as unknown as MarketplaceSnapshot;
      return {
        sellerId: snapshot.sellerId,
        orderId: order.id,
        orderItemId: i.id,
        marketplaceListingId: snapshot.listingId,
        amountKobo: snapshot.split.sellerEarningKobo * i.quantity,
        entryType: "sale_credit" as const,
        status: "pending" as const,
      };
    });
  if (credits.length > 0) await tx.insert(schema.sellerEarningsLedger).values(credits).onConflictDoNothing();

  await tx
    .update(schema.orders)
    .set({
      status: "paid",
      paidAt: new Date(),
      ...(attention.length > 0 && { needsAttention: true, attentionReason: attention.join("; ") }),
    })
    .where(eq(schema.orders.id, order.id));

  const emailId = await queueEmail(tx, {
    dedupeKey: `order_paid:${order.id}`,
    to: order.email,
    template: "order_paid",
    payload: {
      name: order.deliveryAddress.fullName,
      orderNumber: order.orderNumber,
      items: items.map((i) => {
        const view = buyerView(i.itemSnapshot as unknown as ItemSnapshot);
        return { name: view.name, detail: view.detail, quantity: i.quantity, lineTotalKobo: i.lineTotalKobo };
      }),
      shippingFeeKobo: order.shippingFeeKobo,
      totalKobo: order.totalKobo,
      eta: order.etaFrom && order.etaTo ? formatWindow(order.etaFrom, order.etaTo) : null,
      lookupUrl: `${env().APP_URL}/orders/lookup?order=${order.orderNumber}`,
    },
  });
  return [emailId];
}
