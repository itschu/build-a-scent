import "server-only";
import { and, count, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { env } from "@/env";
import { CANCELLABLE, NEXT_FULFILMENT_STEP, REFUNDABLE } from "@/lib/admin-order-status";
import { formatWindow } from "@/lib/delivery-estimate";
import type { OrderItemType, OrderStatus } from "@/lib/domain";
import type { ItemSnapshot } from "@/lib/order-snapshot";
import { getDb, schema, type Tx } from "@/server/db";
import { deliverEmails, queueEmail } from "@/server/email";
import { getGateway } from "@/server/payments";
import { applyVerifiedPayment, releaseReservations, type ApplyOutcome } from "@/server/payments/apply";
import { assertAdmin, NotFoundError, ValidationError, type Actor } from "./actor";

export const ORDER_TABS = ["review", "fulfil", "all"] as const;
export type OrderTab = (typeof ORDER_TABS)[number];
export const ORDERS_PAGE_SIZE = 25;

const FULFIL_STATUSES: OrderStatus[] = ["paid", "in_production", "shipped"];

export type AdminOrderRow = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  needsAttention: boolean;
  attentionReason: string | null;
  email: string;
  customerName: string;
  totalKobo: number;
  paymentGateway: string;
  createdAt: Date;
  verifyingSince: Date | null;
  itemTypes: OrderItemType[];
};

/** Tab filters: Needs Review (stuck verification or flagged), To Fulfil, All. */
function tabFilter(tab: OrderTab): SQL | undefined {
  if (tab === "review") return or(eq(schema.orders.status, "verifying_payment"), eq(schema.orders.needsAttention, true));
  if (tab === "fulfil") return inArray(schema.orders.status, FULFIL_STATUSES);
  return undefined;
}

export async function listOrdersForAdmin(
  actor: Actor,
  filters: { tab: OrderTab; status?: OrderStatus | null; type?: OrderItemType | null; q?: string | null; page?: number },
): Promise<{ rows: AdminOrderRow[]; total: number; counts: Record<OrderTab, number> }> {
  assertAdmin(actor);
  const db = getDb();
  const search = filters.q?.trim();
  const where = and(
    tabFilter(filters.tab),
    filters.status ? eq(schema.orders.status, filters.status) : undefined,
    filters.type
      ? sql`exists (select 1 from ${schema.orderItems} oi where oi.order_id = ${schema.orders.id} and oi.item_type = ${filters.type})`
      : undefined,
    search ? or(ilike(schema.orders.orderNumber, `%${search}%`), ilike(schema.orders.email, `%${search}%`)) : undefined,
  );
  const page = Math.max(1, filters.page ?? 1);

  const [orders, [{ total }], countRows] = await Promise.all([
    db
      .select({
        order: schema.orders,
        itemTypes: sql<OrderItemType[]>`(select coalesce(array_agg(distinct oi.item_type), '{}') from ${schema.orderItems} oi where oi.order_id = ${schema.orders.id})`,
      })
      .from(schema.orders)
      .where(where)
      .orderBy(filters.tab === "fulfil" ? schema.orders.paidAt : desc(schema.orders.createdAt))
      .limit(ORDERS_PAGE_SIZE)
      .offset((page - 1) * ORDERS_PAGE_SIZE),
    db.select({ total: count() }).from(schema.orders).where(where),
    Promise.all(ORDER_TABS.map((t) => db.select({ n: count() }).from(schema.orders).where(tabFilter(t)))),
  ]);

  return {
    total,
    counts: Object.fromEntries(ORDER_TABS.map((t, i) => [t, countRows[i][0].n])) as Record<OrderTab, number>,
    rows: orders.map(({ order, itemTypes }) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      needsAttention: order.needsAttention,
      attentionReason: order.attentionReason,
      email: order.email,
      customerName: order.deliveryAddress.fullName,
      totalKobo: order.totalKobo,
      paymentGateway: order.paymentGateway,
      createdAt: order.createdAt,
      verifyingSince: order.verifyingSince,
      itemTypes,
    })),
  };
}

export type AdminOrderDetail = {
  order: typeof schema.orders.$inferSelect;
  items: Array<{ id: string; itemType: OrderItemType; quantity: number; unitPriceKobo: number; lineTotalKobo: number; snapshot: ItemSnapshot }>;
  webhookEvents: Array<{ eventId: string; createdAt: Date; processedAt: Date | null }>;
  ledger: Array<{ id: string; sellerId: string; amountKobo: number; entryType: string; status: string }>;
  reservations: Array<{ id: string; quantity: number; status: string; expiresAt: Date }>;
};

/** Everything about one order, including full formulas for the blending team. */
export async function getOrderForAdmin(actor: Actor, id: string): Promise<AdminOrderDetail> {
  assertAdmin(actor);
  const db = getDb();
  const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, id));
  if (!order) throw new NotFoundError("Order not found");
  const [items, webhookEvents, ledger, reservations] = await Promise.all([
    db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, id)).orderBy(schema.orderItems.createdAt),
    order.paymentReference
      ? db
          .select({ eventId: schema.webhookEvents.eventId, createdAt: schema.webhookEvents.createdAt, processedAt: schema.webhookEvents.processedAt })
          .from(schema.webhookEvents)
          .where(eq(schema.webhookEvents.reference, order.paymentReference))
          .orderBy(schema.webhookEvents.createdAt)
      : Promise.resolve([]),
    db
      .select({
        id: schema.sellerEarningsLedger.id,
        sellerId: schema.sellerEarningsLedger.sellerId,
        amountKobo: schema.sellerEarningsLedger.amountKobo,
        entryType: schema.sellerEarningsLedger.entryType,
        status: schema.sellerEarningsLedger.status,
      })
      .from(schema.sellerEarningsLedger)
      .where(eq(schema.sellerEarningsLedger.orderId, id)),
    db
      .select({
        id: schema.inventoryReservations.id,
        quantity: schema.inventoryReservations.quantity,
        status: schema.inventoryReservations.status,
        expiresAt: schema.inventoryReservations.expiresAt,
      })
      .from(schema.inventoryReservations)
      .where(eq(schema.inventoryReservations.orderId, id)),
  ]);
  return {
    order,
    items: items.map((i) => ({
      id: i.id,
      itemType: i.itemType,
      quantity: i.quantity,
      unitPriceKobo: i.unitPriceKobo,
      lineTotalKobo: i.lineTotalKobo,
      snapshot: i.itemSnapshot as unknown as ItemSnapshot,
    })),
    webhookEvents,
    ledger,
    reservations,
  };
}

/** Asks the gateway directly and applies the answer through the shared payment path. */
export async function reverifyOrder(actor: Actor, id: string): Promise<ApplyOutcome> {
  assertAdmin(actor);
  const [order] = await getDb().select().from(schema.orders).where(eq(schema.orders.id, id));
  if (!order?.paymentReference) throw new NotFoundError("Order not found");
  const verification = await getGateway(order.paymentGateway).verify(order.paymentReference);
  if (verification.status === "not_found") {
    await getDb().update(schema.orders).set({ lastGatewayStatus: "not_found", lastVerifyAt: new Date() }).where(eq(schema.orders.id, id));
    return "pending";
  }
  return applyVerifiedPayment(order.paymentReference, verification, "admin");
}

/** Recomputes a seller's cached available balance from the ledger (Tech Plan, Decision 13). */
export async function recomputeSellerBalance(tx: Tx, sellerId: string) {
  await tx
    .update(schema.profiles)
    .set({
      sellerAvailableKobo: sql`(select coalesce(sum(${schema.sellerEarningsLedger.amountKobo}), 0) from ${schema.sellerEarningsLedger} where ${schema.sellerEarningsLedger.sellerId} = ${sellerId} and ${schema.sellerEarningsLedger.status} = 'available')`,
    })
    .where(eq(schema.profiles.userId, sellerId));
}

async function lockOrder(tx: Tx, id: string) {
  const [order] = await tx.select().from(schema.orders).where(eq(schema.orders.id, id)).for("update");
  if (!order) throw new NotFoundError("Order not found");
  return order;
}

function lookupUrl(orderNumber: string) {
  return `${env().APP_URL}/orders/lookup?order=${orderNumber}`;
}

/**
 * Moves an order one fulfilment step: paid → in production → shipped → delivered. The
 * customer is emailed at shipped and delivered; delivery releases seller earnings.
 */
export async function advanceFulfilment(actor: Actor, id: string, to: OrderStatus): Promise<void> {
  assertAdmin(actor);
  const emailId = await getDb().transaction(async (tx) => {
    const order = await lockOrder(tx, id);
    if (NEXT_FULFILMENT_STEP[order.status] !== to) {
      throw new ValidationError(`An order that is ${order.status.replace("_", " ")} can't move to ${to.replace("_", " ")}.`);
    }
    await tx.update(schema.orders).set({ status: to }).where(eq(schema.orders.id, id));
    const name = order.deliveryAddress.fullName;

    if (to === "shipped") {
      return queueEmail(tx, {
        dedupeKey: `order_shipped:${id}`,
        to: order.email,
        template: "order_shipped",
        payload: {
          name,
          orderNumber: order.orderNumber,
          eta: order.etaFrom && order.etaTo ? formatWindow(order.etaFrom, order.etaTo) : null,
          lookupUrl: lookupUrl(order.orderNumber),
        },
      });
    }
    if (to === "fulfilled") {
      const released = await tx
        .update(schema.sellerEarningsLedger)
        .set({ status: "available" })
        .where(
          and(
            eq(schema.sellerEarningsLedger.orderId, id),
            eq(schema.sellerEarningsLedger.entryType, "sale_credit"),
            eq(schema.sellerEarningsLedger.status, "pending"),
          ),
        )
        .returning({ sellerId: schema.sellerEarningsLedger.sellerId });
      for (const sellerId of new Set(released.map((r) => r.sellerId))) await recomputeSellerBalance(tx, sellerId);
      return queueEmail(tx, {
        dedupeKey: `order_delivered:${id}`,
        to: order.email,
        template: "order_delivered",
        payload: { name, orderNumber: order.orderNumber, lookupUrl: lookupUrl(order.orderNumber) },
      });
    }
    return null;
  });
  await deliverEmails([emailId]);
}

/** Cancels an order that was never paid and frees any held stock. */
export async function cancelOrder(actor: Actor, id: string): Promise<void> {
  assertAdmin(actor);
  await getDb().transaction(async (tx) => {
    const order = await lockOrder(tx, id);
    if (!CANCELLABLE.includes(order.status)) {
      throw new ValidationError("Only unpaid orders can be cancelled. Record a refund for paid orders.");
    }
    await tx.update(schema.orders).set({ status: "cancelled", needsAttention: false }).where(eq(schema.orders.id, id));
    await releaseReservations(tx, id);
  });
}

export const refundInputSchema = z.object({
  reason: z.string().trim().min(3, "Enter a reason for the refund").max(500),
  restock: z.boolean(),
});

/**
 * Records a full refund already issued in the gateway dashboard (Tech Plan, Decision 19):
 * seller credits are voided (if pending) or reversed with a debit (if already available), the
 * cached balances are recomputed, stock is optionally returned, and the customer is emailed.
 */
export async function recordRefund(actor: Actor, id: string, input: z.input<typeof refundInputSchema>): Promise<void> {
  assertAdmin(actor);
  const { reason, restock } = refundInputSchema.parse(input);
  const emailId = await getDb().transaction(async (tx) => {
    const order = await lockOrder(tx, id);
    if (!REFUNDABLE.includes(order.status)) throw new ValidationError("Only paid orders can be refunded.");
    await tx
      .update(schema.orders)
      .set({ status: "refunded", refundReason: reason, refundedAt: new Date(), needsAttention: false })
      .where(eq(schema.orders.id, id));

    const credits = await tx
      .select()
      .from(schema.sellerEarningsLedger)
      .where(and(eq(schema.sellerEarningsLedger.orderId, id), eq(schema.sellerEarningsLedger.entryType, "sale_credit")));
    for (const credit of credits) {
      if (credit.status === "pending") {
        await tx.update(schema.sellerEarningsLedger).set({ status: "void" }).where(eq(schema.sellerEarningsLedger.id, credit.id));
      } else if (credit.status === "available") {
        await tx
          .insert(schema.sellerEarningsLedger)
          .values({
            sellerId: credit.sellerId,
            orderId: credit.orderId,
            orderItemId: credit.orderItemId,
            marketplaceListingId: credit.marketplaceListingId,
            amountKobo: -credit.amountKobo,
            entryType: "refund_debit",
            status: "available",
          })
          .onConflictDoNothing();
      }
    }
    for (const sellerId of new Set(credits.map((c) => c.sellerId))) await recomputeSellerBalance(tx, sellerId);

    if (restock) {
      const items = await tx
        .select()
        .from(schema.orderItems)
        .where(and(eq(schema.orderItems.orderId, id), eq(schema.orderItems.itemType, "standard_product")));
      for (const item of items) {
        await tx
          .update(schema.productVariants)
          .set({ stockQty: sql`${schema.productVariants.stockQty} + ${item.quantity}` })
          .where(eq(schema.productVariants.id, item.referenceId));
      }
    }

    return queueEmail(tx, {
      dedupeKey: `order_refunded:${id}`,
      to: order.email,
      template: "order_refunded",
      payload: {
        name: order.deliveryAddress.fullName,
        orderNumber: order.orderNumber,
        totalKobo: order.totalKobo,
        reason,
        lookupUrl: lookupUrl(order.orderNumber),
      },
    });
  });
  await deliverEmails([emailId]);
}

/** Clears the attention flag once an admin has dealt with it, keeping a note of how. */
export async function resolveAttention(actor: Actor, id: string, note: string): Promise<void> {
  assertAdmin(actor);
  const resolution = z.string().trim().min(3, "Describe how this was resolved").max(500).parse(note);
  const [order] = await getDb().select().from(schema.orders).where(eq(schema.orders.id, id));
  if (!order) throw new NotFoundError("Order not found");
  await getDb()
    .update(schema.orders)
    .set({ needsAttention: false, attentionReason: `${order.attentionReason ?? "Flagged"} — Resolved: ${resolution}` })
    .where(eq(schema.orders.id, id));
}
