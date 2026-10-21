import "server-only";
import { and, count, desc, gte, inArray, sql } from "drizzle-orm";
import type { OrderItemType, OrderStatus } from "@/lib/domain";
import { getDb, schema } from "@/server/db";
import { assertAdmin, type Actor } from "./actor";

/** Orders that represent real sales: paid or further along, excluding refunds. */
export const SOLD_STATUSES: OrderStatus[] = ["paid", "in_production", "shipped", "fulfilled"];

export const ANALYTICS_RANGES = { "30d": 30, "90d": 90, all: null } as const;
export type AnalyticsRange = keyof typeof ANALYTICS_RANGES;

export type Analytics = {
  revenueKobo: number;
  orderCount: number;
  averageOrderKobo: number;
  byType: Array<{ type: OrderItemType; orders: number; units: number; revenueKobo: number }>;
  topIngredients: Array<{ name: string; colorHex: string; selections: number }>;
  topMarketplace: Array<{ listingId: string; name: string; creatorName: string; units: number; revenueKobo: number }>;
  sellerEarnings: { pendingKobo: number; availableKobo: number; sellers: number };
};

export async function getAnalytics(actor: Actor, range: AnalyticsRange = "30d"): Promise<Analytics> {
  assertAdmin(actor);
  const db = getDb();
  const days = ANALYTICS_RANGES[range];
  const since = days ? new Date(Date.now() - days * 86_400_000) : null;
  const soldOrders = and(inArray(schema.orders.status, SOLD_STATUSES), since ? gte(schema.orders.paidAt, since) : undefined);
  const soldItems = sql`${schema.orderItems.orderId} in (select ${schema.orders.id} from ${schema.orders} where ${soldOrders})`;

  const [[totals], byType, topIngredients, topMarketplace, [earnings]] = await Promise.all([
    db
      .select({ revenue: sql<string>`coalesce(sum(${schema.orders.totalKobo}), 0)`, orders: count() })
      .from(schema.orders)
      .where(soldOrders),
    db
      .select({
        type: schema.orderItems.itemType,
        orders: sql<number>`count(distinct ${schema.orderItems.orderId})::int`,
        units: sql<number>`sum(${schema.orderItems.quantity})::int`,
        revenue: sql<string>`sum(${schema.orderItems.lineTotalKobo})`,
      })
      .from(schema.orderItems)
      .where(soldItems)
      .groupBy(schema.orderItems.itemType),
    // Every ingredient in a sold custom or marketplace blend counts once per bottle.
    db.execute<{ name: string; color_hex: string; selections: number }>(sql`
      select f->>'name' as name, f->>'colorHex' as color_hex, sum(oi.quantity)::int as selections
      from ${schema.orderItems} oi, jsonb_array_elements(oi.item_snapshot->'formula') f
      where oi.item_type in ('custom_scent', 'marketplace_listing') and oi.order_id in (
        select ${schema.orders.id} from ${schema.orders} where ${soldOrders}
      )
      group by 1, 2 order by 3 desc limit 10`),
    db
      .select({
        listingId: sql<string>`${schema.orderItems.itemSnapshot}->>'listingId'`,
        name: sql<string>`max(${schema.orderItems.itemSnapshot}->>'name')`,
        creatorName: sql<string>`max(${schema.orderItems.itemSnapshot}->>'creatorName')`,
        units: sql<number>`sum(${schema.orderItems.quantity})::int`,
        revenue: sql<string>`sum(${schema.orderItems.lineTotalKobo})`,
      })
      .from(schema.orderItems)
      .where(and(soldItems, sql`${schema.orderItems.itemType} = 'marketplace_listing'`))
      .groupBy(sql`${schema.orderItems.itemSnapshot}->>'listingId'`)
      .orderBy(desc(sql`sum(${schema.orderItems.quantity})`))
      .limit(10),
    db
      .select({
        pending: sql<string>`coalesce(sum(${schema.sellerEarningsLedger.amountKobo}) filter (where ${schema.sellerEarningsLedger.status} = 'pending'), 0)`,
        available: sql<string>`coalesce(sum(${schema.sellerEarningsLedger.amountKobo}) filter (where ${schema.sellerEarningsLedger.status} = 'available'), 0)`,
        sellers: sql<number>`count(distinct ${schema.sellerEarningsLedger.sellerId}) filter (where ${schema.sellerEarningsLedger.status} <> 'void')::int`,
      })
      .from(schema.sellerEarningsLedger),
  ]);

  const revenueKobo = Number(totals.revenue);
  return {
    revenueKobo,
    orderCount: totals.orders,
    averageOrderKobo: totals.orders ? Math.round(revenueKobo / totals.orders) : 0,
    byType: byType.map((r) => ({ type: r.type, orders: r.orders, units: r.units, revenueKobo: Number(r.revenue) })),
    topIngredients: topIngredients.rows.map((r) => ({ name: r.name, colorHex: r.color_hex, selections: Number(r.selections) })),
    topMarketplace: topMarketplace.map((r) => ({ ...r, revenueKobo: Number(r.revenue) })),
    sellerEarnings: { pendingKobo: Number(earnings.pending), availableKobo: Number(earnings.available), sellers: earnings.sellers },
  };
}

export async function getQueueCounts(actor: Actor) {
  assertAdmin(actor);
  const db = getDb();
  const [[review], [fulfil], [listings]] = await Promise.all([
    db.select({ n: count() }).from(schema.orders).where(sql`${schema.orders.status} = 'verifying_payment' or ${schema.orders.needsAttention}`),
    db.select({ n: count() }).from(schema.orders).where(inArray(schema.orders.status, ["paid", "in_production", "shipped"])),
    db.select({ n: count() }).from(schema.marketplaceListings).where(sql`${schema.marketplaceListings.status} = 'pending_review'`),
  ]);
  return { needsReview: review.n, toFulfil: fulfil.n, pendingListings: listings.n };
}
