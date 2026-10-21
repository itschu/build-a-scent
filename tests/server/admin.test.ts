import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setEmailTransportForTests } from "@/server/email";
import { initiateCheckout } from "@/server/checkout/initiate";
import { AuthorizationError, GUEST, ValidationError } from "@/server/dal/actor";
import { deleteIngredient, listIngredientsForAdmin, saveBottleOption, saveIngredient, setBottleOptionActive, setIngredientActive } from "@/server/dal/admin-catalog";
import { advanceFulfilment, cancelOrder, listOrdersForAdmin, recordRefund, reverifyOrder } from "@/server/dal/admin-orders";
import { saveShippingZone, updateSettings } from "@/server/dal/admin-settings";
import { getAnalytics } from "@/server/dal/analytics";
import { getPublicListing, getSellerDashboard, submitListing } from "@/server/dal/marketplace";
import { approveListing } from "@/server/dal/moderation";
import { listNotifications } from "@/server/dal/notifications";
import { saveScent } from "@/server/dal/scents";
import { applyVerifiedPayment } from "@/server/payments/apply";
import { fakeTransactions } from "@/server/payments/fake";
import { getSettings } from "@/server/settings";
import { seed } from "../../scripts/seed-data";
import { loadCatalog } from "../support/catalog";
import { freshTestDatabase, testDatabaseUrl } from "../support/db";
import { actorFor, createUser } from "../support/factories";

type Connection = Awaited<ReturnType<typeof freshTestDatabase>>;

describe.skipIf(!testDatabaseUrl)("admin operations", () => {
  let conn: Connection;
  let catalog: Awaited<ReturnType<typeof loadCatalog>>;
  let admin: ReturnType<typeof actorFor>;
  const sent: string[] = [];

  beforeAll(async () => {
    conn = await freshTestDatabase();
    await seed(conn.db, { sampleData: true });
    catalog = await loadCatalog(conn.db);
    admin = actorFor(await createUser(conn.db, { role: "admin" }));
    setEmailTransportForTests({ sendMail: async (m: { subject: string }) => (sent.push(m.subject), {}) } as never);
  });

  afterAll(async () => {
    setEmailTransportForTests(undefined);
    await conn?.close();
  });

  let n = 0;
  async function liveListing(names: string[]) {
    const seller = actorFor(await createUser(conn.db, { name: `Seller ${++n}` }));
    const { id: scentId } = await saveScent(seller, { name: `Blend ${n}`, formula: names.map(catalog.entry), bottleOptionId: catalog.bottle(50, "spray").id });
    const { id } = await submitListing(seller, { scentId, description: "", creatorMarkupKobo: 500_000, featuredIngredientIds: [] });
    await approveListing(admin, id);
    return { id, seller };
  }

  const delivery = { fullName: "Ada Obi", email: "ada@example.com", phone: "08030000000", address: "1 Marina", city: "Lagos", state: "Lagos" as const };

  async function paidOrder(listingId: string, extra: Array<{ type: "standard_product"; key: string; variantId: string; quantity: number; displayPriceKobo: number }> = []) {
    const listing = (await getPublicListing(listingId))!;
    const result = await initiateCheckout(GUEST, {
      lines: [{ type: "marketplace_listing", key: "l", listingId, quantity: 1, displayPriceKobo: listing.buyerPriceKobo }, ...extra],
      delivery,
      gateway: "paystack",
    });
    if (result.kind !== "ready") throw new Error(JSON.stringify(result));
    const [order] = await conn.db.select().from(conn.schema.orders).where(eq(conn.schema.orders.id, result.orderId));
    const tx = fakeTransactions.get(order.paymentReference!)!;
    tx.status = "success";
    await applyVerifiedPayment(order.paymentReference!, { status: "success", amountKobo: tx.amountKobo, currency: "NGN", gatewayStatus: "success" }, "webhook");
    return order;
  }

  it("rejects non-admins everywhere", async () => {
    const user = actorFor(await createUser(conn.db));
    await expect(setIngredientActive(user, catalog.ing("Rose").id, false)).rejects.toBeInstanceOf(AuthorizationError);
    await expect(updateSettings(user, { commission_pct: 1 })).rejects.toBeInstanceOf(AuthorizationError);
    await expect(getAnalytics(user)).rejects.toBeInstanceOf(AuthorizationError);
  });

  describe("catalog", () => {
    it("deactivating an ingredient pauses its listings and notifies; reactivating restores them", async () => {
      const { id, seller } = await liveListing(["Musk", "Iris", "Mint"]);
      const result = await setIngredientActive(admin, catalog.ing("Iris").id, false);
      expect(result.paused).toBeGreaterThanOrEqual(1);
      const [row] = await conn.db.select().from(conn.schema.marketplaceListings).where(eq(conn.schema.marketplaceListings.id, id));
      expect(row).toMatchObject({ status: "unavailable", unavailableReason: "Ingredient Iris was discontinued." });
      expect(await getPublicListing(id)).toBeNull();
      expect((await listNotifications(seller))[0].type).toBe("listing_unavailable");

      expect((await setIngredientActive(admin, catalog.ing("Iris").id, true)).restored).toBeGreaterThanOrEqual(1);
      expect(await getPublicListing(id)).not.toBeNull();
      expect((await listNotifications(seller))[0].type).toBe("listing_available");
    });

    it("deactivating a bottle option pauses listings that use it", async () => {
      const { id } = await liveListing(["Amber", "Geranium", "Lavender"]);
      await setBottleOptionActive(admin, catalog.bottle(50, "spray").id, false);
      try {
        expect(await getPublicListing(id)).toBeNull();
      } finally {
        await setBottleOptionActive(admin, catalog.bottle(50, "spray").id, true);
      }
      expect(await getPublicListing(id)).not.toBeNull();
    });

    it("only never-used ingredients can be deleted, and used ones can't change tier", async () => {
      await expect(deleteIngredient(admin, catalog.ing("Musk").id)).rejects.toBeInstanceOf(ValidationError);
      const musk = catalog.ing("Musk");
      await expect(
        saveIngredient(admin, { id: musk.id, name: "Musk", noteTier: "top", scentFamily: "Musky", colorHex: musk.colorHex, pricePerMlKobo: 1, imageUrl: null }),
      ).rejects.toThrow(/tier can't change/);
      const { id } = await saveIngredient(admin, { name: "Saffron", noteTier: "heart", scentFamily: "Spicy", colorHex: "#d4a017", pricePerMlKobo: 300_000, imageUrl: null });
      await expect(saveIngredient(admin, { name: "saffron", noteTier: "top", scentFamily: "Spicy", colorHex: "#000000", pricePerMlKobo: 1, imageUrl: null })).rejects.toThrow(
        /already exists/,
      );
      await deleteIngredient(admin, id);
    });

    it("the ingredient list counts the scents that use each ingredient", async () => {
      await liveListing(["Cedarwood", "Jasmine", "Grapefruit"]);
      const rows = await listIngredientsForAdmin(admin);
      expect(rows.find((r) => r.name === "Cedarwood")).toMatchObject({ referenced: true });
      expect(rows.find((r) => r.name === "Cedarwood")!.usedBy).toBeGreaterThanOrEqual(1);
    });

    it("bottle options are unique by size and format", async () => {
      await expect(saveBottleOption(admin, { volumeMl: 50, format: "spray", concentrationPct: 20, basePriceKobo: 1 })).rejects.toThrow(/already exists/);
      const { id } = await saveBottleOption(admin, { volumeMl: 50, format: "oil", concentrationPct: 100, basePriceKobo: 1_400_000 });
      const [row] = await conn.db.select().from(conn.schema.bottleOptions).where(eq(conn.schema.bottleOptions.id, id));
      expect(row.sizeLabel).toBe("50ml");
    });
  });

  describe("orders", () => {
    it("the order list shows each order's item types and filters by them", async () => {
      const { id } = await liveListing(["Oud", "Rose", "Lemon"]);
      const order = await paidOrder(id);
      const all = await listOrdersForAdmin(admin, { tab: "all", q: order.orderNumber });
      expect(all.rows[0].itemTypes).toEqual(["marketplace_listing"]);
      expect((await listOrdersForAdmin(admin, { tab: "all", q: order.orderNumber, type: "marketplace_listing" })).total).toBe(1);
      expect((await listOrdersForAdmin(admin, { tab: "all", q: order.orderNumber, type: "custom_scent" })).total).toBe(0);
    });

    it("moves through fulfilment one step at a time and releases seller earnings on delivery", async () => {
      const { id, seller } = await liveListing(["Sandalwood", "Rose", "Bergamot"]);
      const order = await paidOrder(id);
      await expect(advanceFulfilment(admin, order.id, "shipped")).rejects.toBeInstanceOf(ValidationError);
      await advanceFulfilment(admin, order.id, "in_production");
      await advanceFulfilment(admin, order.id, "shipped");
      expect(sent).toContain(`Order ${order.orderNumber} is on its way`);
      expect((await getSellerDashboard(seller)).earnings).toMatchObject({ pendingKobo: 400_000, availableKobo: 0 });

      await advanceFulfilment(admin, order.id, "fulfilled");
      expect(sent).toContain(`Order ${order.orderNumber} has been delivered`);
      expect((await getSellerDashboard(seller)).earnings).toMatchObject({ pendingKobo: 0, availableKobo: 400_000 });
    });

    it("refunds void pending earnings, or debit available ones (balance can go negative), and can restock", async () => {
      const { id, seller } = await liveListing(["Oud", "Jasmine", "Grapefruit"]);
      const [variant] = await conn.db.select().from(conn.schema.productVariants).where(eq(conn.schema.productVariants.sizeLabel, "30ml"));
      const stockBefore = variant.stockQty;
      const first = await paidOrder(id, [{ type: "standard_product", key: "v", variantId: variant.id, quantity: 2, displayPriceKobo: variant.priceKobo }]);
      await recordRefund(admin, first.id, { reason: "Customer changed their mind", restock: true });
      const [after] = await conn.db.select().from(conn.schema.productVariants).where(eq(conn.schema.productVariants.id, variant.id));
      expect(after.stockQty).toBe(stockBefore);
      const firstLedger = await conn.db.select().from(conn.schema.sellerEarningsLedger).where(eq(conn.schema.sellerEarningsLedger.orderId, first.id));
      expect(firstLedger.map((l) => l.status)).toEqual(["void"]);

      const second = await paidOrder(id);
      for (const step of ["in_production", "shipped", "fulfilled"] as const) await advanceFulfilment(admin, second.id, step);
      expect((await getSellerDashboard(seller)).earnings.availableKobo).toBe(400_000);
      await recordRefund(admin, second.id, { reason: "Arrived damaged", restock: false });
      const dashboard = await getSellerDashboard(seller);
      expect(dashboard.earnings.availableKobo).toBe(0);
      expect(dashboard.earnings.entries.map((e) => [e.entryType, e.amountKobo])).toContainEqual(["refund_debit", -400_000]);
      await expect(recordRefund(admin, second.id, { reason: "again", restock: false })).rejects.toBeInstanceOf(ValidationError);
      expect(sent).toContain(`Refund for order ${second.orderNumber}`);
    });

    it("cancels only unpaid orders and frees their holds", async () => {
      const result = await initiateCheckout(GUEST, {
        lines: [{ type: "custom_scent", key: "c", name: "X", formula: ["Musk", "Rose", "Mint"].map(catalog.entry), bottleOptionId: catalog.bottle(30, "spray").id, quantity: 1, displayPriceKobo: 0 }],
        delivery,
        gateway: "paystack",
      });
      expect(result.kind).toBe("changed"); // price 0 is stale, which proves revalidation; use the real price
      const real = await initiateCheckout(GUEST, {
        lines: [
          {
            type: "custom_scent",
            key: "c",
            name: "X",
            formula: ["Musk", "Rose", "Mint"].map(catalog.entry),
            bottleOptionId: catalog.bottle(30, "spray").id,
            quantity: 1,
            displayPriceKobo: result.kind === "changed" && result.issues[0].kind === "price_changed" ? result.issues[0].newPriceKobo : 0,
          },
        ],
        delivery,
        gateway: "paystack",
      });
      if (real.kind !== "ready") throw new Error("expected ready");
      await cancelOrder(admin, real.orderId);
      const [row] = await conn.db.select().from(conn.schema.orders).where(eq(conn.schema.orders.id, real.orderId));
      expect(row.status).toBe("cancelled");
      await expect(recordRefund(admin, real.orderId, { reason: "nope", restock: false })).rejects.toBeInstanceOf(ValidationError);
    });

    it("re-verifies with the gateway through the shared payment path", async () => {
      const { id } = await liveListing(["Cedarwood", "Peony", "Lemon"]);
      const listing = (await getPublicListing(id))!;
      const result = await initiateCheckout(GUEST, {
        lines: [{ type: "marketplace_listing", key: "l", listingId: id, quantity: 1, displayPriceKobo: listing.buyerPriceKobo }],
        delivery,
        gateway: "flutterwave",
      });
      if (result.kind !== "ready") throw new Error("expected ready");
      const [order] = await conn.db.select().from(conn.schema.orders).where(eq(conn.schema.orders.id, result.orderId));
      expect(await reverifyOrder(admin, order.id)).toBe("pending");
      fakeTransactions.get(order.paymentReference!)!.status = "success";
      expect(await reverifyOrder(admin, order.id)).toBe("paid");
    });
  });

  it("analytics counts only sold orders", async () => {
    const stats = await getAnalytics(admin, "all");
    const sold = await conn.db.select().from(conn.schema.orders).where(eq(conn.schema.orders.status, "fulfilled"));
    expect(stats.orderCount).toBeGreaterThanOrEqual(sold.length);
    expect(stats.byType.find((t) => t.type === "marketplace_listing")?.units).toBeGreaterThan(0);
    expect(stats.topIngredients.length).toBeGreaterThan(0);
    expect(stats.topMarketplace[0]).toHaveProperty("creatorName");
    expect(stats.revenueKobo).toBeGreaterThan(0);
    const refunded = await conn.db.select().from(conn.schema.orders).where(eq(conn.schema.orders.status, "refunded"));
    expect(refunded.length).toBe(2);
  });

  it("settings validate values and tier shares; zones can't overlap", async () => {
    await expect(updateSettings(admin, { tier_share_base: 50 })).rejects.toThrow(/add up to 100/);
    await expect(updateSettings(admin, { commission_pct: 150 })).rejects.toBeInstanceOf(ValidationError);
    await updateSettings(admin, { commission_pct: 15, tier_share_base: 50, tier_share_heart: 30, tier_share_top: 20 });
    expect(await getSettings()).toMatchObject({ commission_pct: 15, tier_share_base: 50 });
    await expect(saveShippingZone(admin, { name: "Overlap", states: ["Lagos"], feeKobo: 1, etaMinDays: 1, etaMaxDays: 2 })).rejects.toThrow(/Lagos already belongs/);
    await expect(saveShippingZone(admin, { name: "Bad", states: ["Ogun"], feeKobo: 1, etaMinDays: 5, etaMaxDays: 2 })).rejects.toThrow();
  });
});
