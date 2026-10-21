import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { OrderStatus } from "@/lib/domain";
import { buyerView, type BuyerItemView, type ItemSnapshot } from "@/lib/order-snapshot";
import { getDb, schema } from "@/server/db";
import { assertSignedIn, isAdmin, type Actor } from "./actor";

export type BuyerOrderView = {
  orderNumber: string;
  status: OrderStatus;
  createdAt: Date;
  paidAt: Date | null;
  items: Array<{ view: BuyerItemView; quantity: number; unitPriceKobo: number; lineTotalKobo: number }>;
  subtotalKobo: number;
  shippingFeeKobo: number;
  totalKobo: number;
  etaFrom: string | null;
  etaTo: string | null;
  /** Confirmation-safe delivery details: name and area only. */
  deliverTo: { fullName: string; city: string; state: string };
};

type OrderRow = typeof schema.orders.$inferSelect;

async function toBuyerViews(orders: OrderRow[]): Promise<BuyerOrderView[]> {
  if (orders.length === 0) return [];
  const items = await getDb()
    .select()
    .from(schema.orderItems)
    .where(inArray(schema.orderItems.orderId, orders.map((o) => o.id)))
    .orderBy(schema.orderItems.createdAt);
  return orders.map((order) => ({
    orderNumber: order.orderNumber,
    status: order.status,
    createdAt: order.createdAt,
    paidAt: order.paidAt,
    items: items
      .filter((i) => i.orderId === order.id)
      .map((i) => ({
        view: buyerView(i.itemSnapshot as unknown as ItemSnapshot),
        quantity: i.quantity,
        unitPriceKobo: i.unitPriceKobo,
        lineTotalKobo: i.lineTotalKobo,
      })),
    subtotalKobo: order.subtotalKobo,
    shippingFeeKobo: order.shippingFeeKobo,
    totalKobo: order.totalKobo,
    etaFrom: order.etaFrom,
    etaTo: order.etaTo,
    deliverTo: {
      fullName: order.deliveryAddress.fullName,
      city: order.deliveryAddress.city,
      state: order.deliveryAddress.state,
    },
  }));
}

/** Who may see an order: its owner, the browser holding its checkout context, or an admin. */
export type OrderAccess = { actor: Actor; checkoutOrderId: string | null };

export function canViewOrder(order: Pick<OrderRow, "id" | "userId">, access: OrderAccess): boolean {
  if (access.checkoutOrderId === order.id) return true;
  if (access.actor.kind !== "user") return false;
  return order.userId === access.actor.userId || isAdmin(access.actor);
}

export async function findOrderByNumber(orderNumber: string): Promise<OrderRow | null> {
  const [order] = await getDb().select().from(schema.orders).where(eq(schema.orders.orderNumber, orderNumber));
  return order ?? null;
}

export async function getBuyerOrder(orderNumber: string, access: OrderAccess): Promise<BuyerOrderView | null> {
  const order = await findOrderByNumber(orderNumber);
  if (!order || !canViewOrder(order, access)) return null;
  return (await toBuyerViews([order]))[0];
}

/** Guest lookup (Flow 10): both the order number and the email must match. */
export async function lookupOrder(orderNumber: string, email: string): Promise<BuyerOrderView | null> {
  const [order] = await getDb()
    .select()
    .from(schema.orders)
    .where(
      and(
        eq(schema.orders.orderNumber, orderNumber),
        eq(sql`lower(${schema.orders.email})`, email.trim().toLowerCase()),
      ),
    );
  return order ? (await toBuyerViews([order]))[0] : null;
}

/** The actor's orders, newest first. Unpaid checkouts that never completed are left out. */
export async function listOwnOrders(actor: Actor): Promise<BuyerOrderView[]> {
  assertSignedIn(actor);
  const orders = await getDb()
    .select()
    .from(schema.orders)
    .where(
      and(
        eq(schema.orders.userId, actor.userId),
        inArray(schema.orders.status, ["verifying_payment", "paid", "in_production", "shipped", "fulfilled", "refunded"]),
      ),
    )
    .orderBy(desc(schema.orders.createdAt))
    .limit(50);
  return toBuyerViews(orders);
}
