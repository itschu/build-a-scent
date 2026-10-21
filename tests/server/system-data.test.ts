// Remaining Authorization Rules from the Tech Plan (§3) for system data. Reservations, ledger
// entries, notifications, webhook events and outbox rows have no user-facing write path at
// all: they are only written by server code covered in checkout, admin and hardening tests.
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listShippingZones } from "@/server/checkout/shipping";
import { getSellerDashboard } from "@/server/dal/marketplace";
import { getPublicSettings } from "@/server/settings";
import { PUBLIC_SETTING_KEYS } from "@/lib/settings";
import { seed } from "../../scripts/seed-data";
import { freshTestDatabase, testDatabaseUrl } from "../support/db";
import { actorFor, createUser } from "../support/factories";

type Connection = Awaited<ReturnType<typeof freshTestDatabase>>;

describe.skipIf(!testDatabaseUrl)("system data access", () => {
  let conn: Connection;

  beforeAll(async () => {
    conn = await freshTestDatabase();
    await seed(conn.db, { sampleData: true });
  });

  afterAll(async () => {
    await conn?.close();
  });

  it("the public can read only public platform settings", async () => {
    const settings = await getPublicSettings();
    expect(Object.keys(settings).sort()).toEqual([...PUBLIC_SETTING_KEYS].sort());
    expect(settings).not.toHaveProperty("low_stock_reserve_threshold");
    expect(settings).not.toHaveProperty("payment_window_minutes");
  });

  it("the public can read only active shipping zones", async () => {
    await conn.db.update(conn.schema.shippingZones).set({ isActive: false }).where(eq(conn.schema.shippingZones.name, "Lagos"));
    expect((await listShippingZones()).map((z) => z.name)).toEqual(["Rest of Nigeria"]);
  });

  it("sellers can read only their own ledger entries", async () => {
    const a = await createUser(conn.db);
    const b = await createUser(conn.db);
    const [bottle] = await conn.db.select().from(conn.schema.bottleOptions).limit(1);
    const [scent] = await conn.db
      .insert(conn.schema.savedScents)
      .values({ userId: a.id, status: "saved", name: "A's scent", bottleOptionId: bottle.id, formulaHash: "h" })
      .returning();
    const [listing] = await conn.db
      .insert(conn.schema.marketplaceListings)
      .values({ savedScentId: scent.id, sellerId: a.id, bottleOptionId: bottle.id, creatorMarkupKobo: 100_000, status: "approved" })
      .returning();
    const [order] = await conn.db
      .insert(conn.schema.orders)
      .values({
        orderNumber: "BAS-LEDGER",
        email: "x@example.com",
        paymentGateway: "paystack",
        subtotalKobo: 0,
        shippingFeeKobo: 0,
        totalKobo: 0,
        deliveryAddress: { fullName: "X", phone: "1", address: "x", city: "x", state: "Lagos" },
      })
      .returning();
    const [item] = await conn.db
      .insert(conn.schema.orderItems)
      .values({ orderId: order.id, itemType: "marketplace_listing", referenceId: listing.id, itemSnapshot: {}, quantity: 1, unitPriceKobo: 0, lineTotalKobo: 0 })
      .returning();
    await conn.db.insert(conn.schema.sellerEarningsLedger).values({
      sellerId: a.id,
      orderId: order.id,
      orderItemId: item.id,
      marketplaceListingId: listing.id,
      amountKobo: 80_000,
      entryType: "sale_credit",
    });

    expect((await getSellerDashboard(actorFor(a))).earnings.entries).toHaveLength(1);
    const other = await getSellerDashboard(actorFor(b));
    expect(other.earnings.entries).toEqual([]);
    expect(other.earnings.pendingKobo).toBe(0);
  });
});
