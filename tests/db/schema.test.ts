import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { promoteToAdmin, UserNotFoundError } from "../../scripts/admin";
import { seed } from "../../scripts/seed-data";
import { freshTestDatabase, testDatabaseUrl } from "../support/db";

type Connection = Awaited<ReturnType<typeof freshTestDatabase>>;

describe.skipIf(!testDatabaseUrl)("database schema", () => {
  let conn: Connection;

  beforeAll(async () => {
    conn = await freshTestDatabase();
  });

  afterAll(async () => {
    await conn?.close();
  });

  /** Runs a statement that must fail, rolling back so later statements are unaffected. */
  async function expectRejected(run: () => Promise<unknown>, constraint: string) {
    await expect(
      conn.db.transaction(async () => {
        await run();
      }),
    ).rejects.toMatchObject({ cause: expect.objectContaining({ constraint }) });
  }

  async function createUser(email: string) {
    const [user] = await conn.db
      .insert(conn.schema.users)
      .values({ name: "Test User", email })
      .returning();
    return user;
  }

  it("creates every table in the Tech Plan data model", async () => {
    const result = await conn.db.execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables where table_schema = 'public' order by table_name`,
    );
    expect(result.rows.map((r) => r.table_name)).toEqual([
      "accounts",
      "bottle_options",
      "email_outbox",
      "ingredients",
      "inventory_reservations",
      "marketplace_listings",
      "notifications",
      "order_items",
      "orders",
      "platform_settings",
      "product_variants",
      "products",
      "profiles",
      "rate_limits",
      "saved_scents",
      "seller_earnings_ledger",
      "sessions",
      "shipping_zones",
      "users",
      "verifications",
      "webhook_events",
    ]);
  });

  it("seeds settings, bottle options and shipping zones idempotently", async () => {
    await seed(conn.db, { sampleData: true });
    // An admin edit must survive a re-seed.
    await conn.db
      .update(conn.schema.platformSettings)
      .set({ value: 15 })
      .where(eq(conn.schema.platformSettings.key, "commission_pct"));
    await seed(conn.db, { sampleData: true });

    const settings = await conn.db.select().from(conn.schema.platformSettings);
    expect(settings).toHaveLength(10);
    expect(settings.find((s) => s.key === "commission_pct")?.value).toBe(15);
    expect(settings.find((s) => s.key === "low_stock_reserve_threshold")?.isPublic).toBe(false);
    expect(await conn.db.$count(conn.schema.bottleOptions)).toBe(8);
    expect(await conn.db.$count(conn.schema.shippingZones)).toBe(2);
    expect(await conn.db.$count(conn.schema.ingredients)).toBe(18);
  });

  it("rejects values outside the allowed enums", async () => {
    await expectRejected(
      () => createUser("bad-role@example.com").then((u) =>
        conn.db.update(conn.schema.users).set({ role: "owner" as never }).where(eq(conn.schema.users.id, u.id)),
      ),
      "users_role_check",
    );
    await expectRejected(
      () =>
        conn.db.insert(conn.schema.ingredients).values({
          name: "Bad Tier",
          noteTier: "middle" as never,
          scentFamily: "Floral",
          colorHex: "#ffffff",
          pricePerMlKobo: 100,
        }),
      "ingredients_note_tier_check",
    );
  });

  it("requires saved scents to be complete but allows partial drafts", async () => {
    const user = await createUser("scents@example.com");
    await conn.db.insert(conn.schema.savedScents).values({ userId: user.id, status: "draft", currentStep: "heart" });
    await expectRejected(
      () => conn.db.insert(conn.schema.savedScents).values({ userId: user.id, status: "saved", name: "Incomplete" }),
      "saved_scents_saved_complete_check",
    );
  });

  it("enforces order totals and unique order numbers", async () => {
    const order = {
      orderNumber: "BAS-TEST01",
      email: "buyer@example.com",
      paymentGateway: "paystack" as const,
      subtotalKobo: 2_305_000,
      shippingFeeKobo: 300_000,
      totalKobo: 2_605_000,
      deliveryAddress: { fullName: "A", phone: "1", address: "x", city: "Lagos", state: "Lagos" },
    };
    await conn.db.insert(conn.schema.orders).values(order);
    await expectRejected(() => conn.db.insert(conn.schema.orders).values(order), "orders_order_number_unique");
    await expectRejected(
      () => conn.db.insert(conn.schema.orders).values({ ...order, orderNumber: "BAS-TEST02", totalKobo: 1 }),
      "orders_totals_check",
    );
  });

  it("allows one ledger entry of each type per order item", async () => {
    const seller = await createUser("seller@example.com");
    const [bottle] = await conn.db.select().from(conn.schema.bottleOptions).limit(1);
    const [scent] = await conn.db
      .insert(conn.schema.savedScents)
      .values({ userId: seller.id, status: "saved", name: "Midnight Bloom", bottleOptionId: bottle.id, formulaHash: "x" })
      .returning();
    const [listing] = await conn.db
      .insert(conn.schema.marketplaceListings)
      .values({ savedScentId: scent.id, sellerId: seller.id, bottleOptionId: bottle.id, creatorMarkupKobo: 500_000 })
      .returning();
    const [order] = await conn.db.select().from(conn.schema.orders).limit(1);
    const [item] = await conn.db
      .insert(conn.schema.orderItems)
      .values({
        orderId: order.id,
        itemType: "marketplace_listing",
        referenceId: listing.id,
        itemSnapshot: {},
        quantity: 1,
        unitPriceKobo: 2_805_000,
        lineTotalKobo: 2_805_000,
      })
      .returning();
    const credit = {
      sellerId: seller.id,
      orderId: order.id,
      orderItemId: item.id,
      marketplaceListingId: listing.id,
      amountKobo: 400_000,
      entryType: "sale_credit" as const,
    };
    await conn.db.insert(conn.schema.sellerEarningsLedger).values(credit);
    await expectRejected(
      () => conn.db.insert(conn.schema.sellerEarningsLedger).values(credit),
      "seller_earnings_ledger_item_entry_unique",
    );
    await expectRejected(
      () =>
        conn.db
          .insert(conn.schema.marketplaceListings)
          .values({ savedScentId: scent.id, sellerId: seller.id, bottleOptionId: bottle.id, creatorMarkupKobo: 1 }),
      "marketplace_listings_saved_scent_unique",
    );
  });

  it("deduplicates webhook events and outbox emails", async () => {
    const event = { gateway: "paystack" as const, eventId: "evt_1", payload: {} };
    await conn.db.insert(conn.schema.webhookEvents).values(event);
    await expectRejected(
      () => conn.db.insert(conn.schema.webhookEvents).values(event),
      "webhook_events_gateway_event_unique",
    );
    const email = { dedupeKey: "order_paid:1", toEmail: "a@example.com", template: "order_paid", payload: {} };
    await conn.db.insert(conn.schema.emailOutbox).values(email);
    await expectRejected(
      () => conn.db.insert(conn.schema.emailOutbox).values(email),
      "email_outbox_dedupe_key_unique",
    );
  });

  it("promotes an existing user to admin idempotently", async () => {
    await createUser("Owner@Example.com");
    await promoteToAdmin(conn.db, "owner@example.com");
    const promoted = await promoteToAdmin(conn.db, " OWNER@example.com ");
    const [user] = await conn.db.select().from(conn.schema.users).where(eq(conn.schema.users.id, promoted.id));
    expect(user.role).toBe("admin");
    await expect(promoteToAdmin(conn.db, "nobody@example.com")).rejects.toBeInstanceOf(UserNotFoundError);
  });
});
