import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { initiateCheckout } from "@/server/checkout/initiate";
import { ValidationError } from "@/server/dal/actor";
import { updateSettings } from "@/server/dal/admin-settings";
import { deliveredOrderCount, getListingDraft, listMarketplace, submitListing, withdrawListing } from "@/server/dal/marketplace";
import { saveScent } from "@/server/dal/scents";
import { setEmailTransportForTests } from "@/server/email";
import { defaultSettings, type SettingValues } from "@/lib/settings";
import { seed } from "../../scripts/seed-data";
import { loadCatalog } from "../support/catalog";
import { freshTestDatabase, testDatabaseUrl } from "../support/db";
import { actorFor, createUser } from "../support/factories";

type Connection = Awaited<ReturnType<typeof freshTestDatabase>>;

describe.skipIf(!testDatabaseUrl)("store and selling rules (admin settings)", () => {
  let conn: Connection;
  let catalog: Awaited<ReturnType<typeof loadCatalog>>;
  let admin: ReturnType<typeof actorFor>;

  beforeAll(async () => {
    conn = await freshTestDatabase();
    await seed(conn.db, { sampleData: true });
    catalog = await loadCatalog(conn.db);
    admin = actorFor(await createUser(conn.db, { role: "admin" }));
    setEmailTransportForTests({ sendMail: async () => ({}) });
  });

  afterAll(async () => {
    setEmailTransportForTests(undefined);
    await conn?.close();
  });

  // Every test starts from the defaults.
  beforeEach(async () => {
    await updateSettings(admin, defaultSettings());
  });
  const settings = (patch: Partial<SettingValues>) => updateSettings(admin, patch);

  const spray50 = () => catalog.bottle(50, "spray").id;
  const delivery = { fullName: "Ada", email: "ada@example.com", phone: "08030000000", address: "1 Marina", city: "Lagos", state: "Lagos" as const };
  const blend = ["Sandalwood", "Rose", "Jasmine", "Bergamot"];
  const edit = { description: "", creatorMarkupKobo: 500_000, featuredIngredientIds: [] };
  let n = 0;

  async function seller() {
    return actorFor(await createUser(conn.db, { name: `Seller ${++n}` }));
  }
  async function scentFor(owner: ReturnType<typeof actorFor>, names = blend) {
    return (await saveScent(owner, { name: `Scent ${++n}`, formula: names.map(catalog.entry), bottleOptionId: spray50() })).id;
  }
  const customLine = (names = blend, price = 2_305_000, quantity = 1) => ({
    type: "custom_scent" as const,
    key: `custom-${names.join("-")}`,
    name: "Midnight Bloom",
    formula: names.map(catalog.entry),
    bottleOptionId: spray50(),
    quantity,
    displayPriceKobo: price,
  });

  /** A real checkout by this user, then marked delivered. */
  async function deliveredOrder(buyer: ReturnType<typeof actorFor>, names = blend, price = 2_305_000) {
    const result = await initiateCheckout(buyer, { lines: [customLine(names, price)], delivery, gateway: "paystack" });
    if (result.kind !== "ready") throw new Error(JSON.stringify(result));
    await conn.db.update(conn.schema.orders).set({ status: "fulfilled" }).where(eq(conn.schema.orders.id, result.orderId));
    return result.orderId;
  }

  describe("orders required before listing", () => {
    it("lets sellers list straight away when the requirement is 0", async () => {
      const me = await seller();
      const scentId = await scentFor(me, ["Musk", "Rose", "Mint"]);
      await expect(submitListing(me, { ...edit, scentId })).resolves.toMatchObject({ status: "pending_review" });
    });

    it("counts only delivered orders of the same scent", async () => {
      await settings({ listing_required_orders: 2, listing_order_scope: "same_scent" });
      const me = await seller();
      const scentId = await scentFor(me);
      await expect(getListingDraft(me, scentId)).rejects.toThrow(/2 delivered orders of it first.*You have 0/);

      await deliveredOrder(me);
      await deliveredOrder(me, ["Oud", "Iris", "Mint"], 3_100_000); // a different blend doesn't count
      const pending = await initiateCheckout(me, { lines: [customLine()], delivery, gateway: "paystack" }); // not delivered
      expect(pending.kind).toBe("ready");
      await expect(submitListing(me, { ...edit, scentId })).rejects.toThrow(/You have 1 so far/);

      await deliveredOrder(me);
      expect(await deliveredOrderCount(me.userId, null)).toBe(0);
      await expect(submitListing(me, { ...edit, scentId })).resolves.toMatchObject({ status: "pending_review" });
    });

    it("can count delivered orders of anything instead", async () => {
      await settings({ listing_required_orders: 1, listing_order_scope: "any" });
      const me = await seller();
      const scentId = await scentFor(me, ["Musk", "Peony", "Lemon"]);
      await expect(submitListing(me, { ...edit, scentId })).rejects.toThrow(/1 delivered order on Build a Scent/);
      await deliveredOrder(me, ["Oud", "Iris", "Mint"], 3_100_000);
      await expect(submitListing(me, { ...edit, scentId })).resolves.toMatchObject({ status: "pending_review" });
    });
  });

  it("caps active listings per seller", async () => {
    await settings({ max_active_listings_per_seller: 1 });
    const me = await seller();
    const first = await submitListing(me, { ...edit, scentId: await scentFor(me, ["Amber", "Rose", "Mint"]) });
    const second = await scentFor(me, ["Cedarwood", "Peony", "Lemon"]);
    await expect(submitListing(me, { ...edit, scentId: second })).rejects.toThrow(/up to 1 active listing/);
    await withdrawListing(me, first.id);
    await expect(submitListing(me, { ...edit, scentId: second })).resolves.toBeTruthy();
  });

  it("pauses new listings", async () => {
    await settings({ listings_enabled: false });
    const me = await seller();
    await expect(submitListing(me, { ...edit, scentId: await scentFor(me, ["Vanilla", "Geranium", "Grapefruit"]) })).rejects.toThrow(/paused/);
  });

  it("approves listings automatically when switched on", async () => {
    await settings({ listing_auto_approve: true });
    const me = await seller();
    const { id, status } = await submitListing(me, { ...edit, scentId: await scentFor(me, ["Oud", "Jasmine", "Pink Pepper"]) });
    expect(status).toBe("approved");
    expect((await listMarketplace()).map((l) => l.id)).toContain(id);
    const [note] = await conn.db.select().from(conn.schema.notifications).where(eq(conn.schema.notifications.userId, me.userId));
    expect(note.type).toBe("listing_approved");
  });

  describe("checkout rules", () => {
    const buyer = async () => actorFor(await createUser(conn.db));

    it("refuses checkout while it's paused, with the admin's message", async () => {
      await settings({ checkout_enabled: false, checkout_paused_message: "Back on Monday!" });
      await expect(initiateCheckout(await buyer(), { lines: [customLine()], delivery, gateway: "paystack" })).rejects.toThrow("Back on Monday!");
    });

    it("enforces a minimum order before shipping", async () => {
      await settings({ min_order_kobo: 3_000_000 });
      const attempt = initiateCheckout(await buyer(), { lines: [customLine()], delivery, gateway: "paystack" });
      await expect(attempt).rejects.toBeInstanceOf(ValidationError);
      await expect(attempt).rejects.toThrow(/minimum order is ₦30,000/);
    });

    it("ships free at or above the threshold", async () => {
      await settings({ free_shipping_threshold_kobo: 2_000_000 });
      const result = await initiateCheckout(await buyer(), { lines: [customLine()], delivery, gateway: "paystack" });
      if (result.kind !== "ready") throw new Error("expected ready");
      const [order] = await conn.db.select().from(conn.schema.orders).where(eq(conn.schema.orders.id, result.orderId));
      expect(order).toMatchObject({ subtotalKobo: 2_305_000, shippingFeeKobo: 0, totalKobo: 2_305_000 });
    });

    it("limits the quantity of each item", async () => {
      await settings({ max_line_quantity: 2 });
      const result = await initiateCheckout(await buyer(), { lines: [customLine(blend, 2_305_000, 5)], delivery, gateway: "paystack" });
      expect(result).toMatchObject({ kind: "changed", issues: [{ kind: "quantity_reduced", newQuantity: 2 }] });
    });
  });
});
