import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { formatNaira } from "@/lib/money";
import type { CheckoutRequest } from "@/lib/validation/checkout";
import { getDb } from "@/server/db";
import { GUEST, ValidationError } from "@/server/dal/actor";
import { getBuyerOrder, lookupOrder } from "@/server/dal/orders";
import { initiateCheckout } from "@/server/checkout/initiate";
import { pollOrderStatus } from "@/server/checkout/status";
import { applyVerifiedPayment } from "@/server/payments/apply";
import { fakeTransactions } from "@/server/payments/fake";
import { paystackSignature } from "@/server/payments/paystack";
import { handlePaymentWebhook } from "@/server/payments/webhooks";
import { setEmailTransportForTests } from "@/server/email";
import { seed } from "../../scripts/seed-data";
import { loadCatalog } from "../support/catalog";
import { freshTestDatabase, testDatabaseUrl } from "../support/db";
import { actorFor, createUser } from "../support/factories";

type Connection = Awaited<ReturnType<typeof freshTestDatabase>>;

describe.skipIf(!testDatabaseUrl)("checkout and payments", () => {
  let conn: Connection;
  let catalog: Awaited<ReturnType<typeof loadCatalog>>;
  let variantId: string;
  let listingId: string;
  let sellerId: string;

  const delivery = {
    fullName: "Adaeze Okonkwo",
    email: "adaeze@example.com",
    phone: "+234 803 000 0000",
    address: "14 Victoria Island",
    city: "Lagos",
    state: "Lagos" as const,
  };

  beforeAll(async () => {
    conn = await freshTestDatabase();
    await seed(conn.db, { sampleData: true });
    catalog = await loadCatalog(conn.db);
    setEmailTransportForTests({ sendMail: async () => ({}) } as never);

    const [product] = await conn.db
      .insert(conn.schema.products)
      .values({ slug: "noir-classic", name: "Noir Classic", scentFamily: "Woody", notes: { base: ["Oud"], heart: [], top: [] } })
      .returning();
    const [variant] = await conn.db
      .insert(conn.schema.productVariants)
      .values({ productId: product.id, sizeLabel: "50ml", format: "spray", priceKobo: 1_800_000, stockQty: 3 })
      .returning();
    variantId = variant.id;

    const seller = await createUser(conn.db, { name: "Emeka Nwosu" });
    sellerId = seller.id;
    const [scent] = await conn.db
      .insert(conn.schema.savedScents)
      .values({
        userId: seller.id,
        status: "saved",
        name: "Desert Gold",
        formula: ["Amber", "Iris", "Lemon"].map(catalog.entry),
        formulaHash: "h",
        bottleOptionId: catalog.bottle(50, "spray").id,
      })
      .returning();
    const [listing] = await conn.db
      .insert(conn.schema.marketplaceListings)
      .values({
        savedScentId: scent.id,
        sellerId: seller.id,
        bottleOptionId: scent.bottleOptionId!,
        creatorMarkupKobo: 500_000,
        featuredIngredientIds: [catalog.ing("Iris").id],
        status: "approved",
      })
      .returning();
    listingId = listing.id;
  });

  afterAll(async () => {
    setEmailTransportForTests(undefined);
    await conn?.close();
  });

  beforeEach(async () => {
    await conn.db.update(conn.schema.productVariants).set({ stockQty: 3 }).where(eq(conn.schema.productVariants.id, variantId));
    await conn.db.delete(conn.schema.inventoryReservations);
  });

  const customLine = (price = 2_305_000) => ({
    type: "custom_scent" as const,
    key: "custom",
    name: "Midnight Bloom",
    formula: ["Sandalwood", "Rose", "Jasmine", "Bergamot"].map(catalog.entry),
    bottleOptionId: catalog.bottle(50, "spray").id,
    quantity: 1,
    displayPriceKobo: price,
  });
  // Desert Gold: Amber 4ml × ₦700 + Iris 3.5ml × ₦1,500 + Lemon 2.5ml × ₦300 = ₦8,800 + ₦15,000 base; + ₦5,000 markup.
  const listingLine = () => ({ type: "marketplace_listing" as const, key: "listing", listingId, quantity: 1, displayPriceKobo: 2_880_000 });
  const variantLine = (quantity = 1) => ({ type: "standard_product" as const, key: "variant", variantId, quantity, displayPriceKobo: 1_800_000 });

  async function checkout(lines: CheckoutRequest["lines"], actor = GUEST) {
    const result = await initiateCheckout(actor, { lines, delivery, gateway: "paystack" });
    if (result.kind !== "ready") throw new Error(`Expected ready, got ${JSON.stringify(result)}`);
    const [order] = await conn.db.select().from(conn.schema.orders).where(eq(conn.schema.orders.id, result.orderId));
    return order;
  }

  function pay(reference: string, overrides: Partial<{ status: "success" | "failed"; reportedKobo: number }> = {}) {
    const tx = fakeTransactions.get(reference)!;
    tx.status = overrides.status ?? "success";
    tx.reportedKobo = overrides.reportedKobo ?? tx.amountKobo;
    return { status: tx.status, amountKobo: tx.reportedKobo, currency: "NGN", gatewayStatus: tx.status } as const;
  }

  it("creates a pending order with server prices, shipping and a low-stock hold", async () => {
    const order = await checkout([customLine(), listingLine(), variantLine()]);
    expect(order).toMatchObject({
      status: "pending_payment",
      subtotalKobo: 2_305_000 + 2_880_000 + 1_800_000,
      shippingFeeKobo: 300_000,
      totalKobo: 2_305_000 + 2_880_000 + 1_800_000 + 300_000,
      email: "adaeze@example.com",
    });
    expect(order.etaFrom).toBeTruthy();
    const items = await conn.db.select().from(conn.schema.orderItems).where(eq(conn.schema.orderItems.orderId, order.id));
    expect(items.map((i) => i.itemType).sort()).toEqual(["custom_scent", "marketplace_listing", "standard_product"]);
    const marketplace = items.find((i) => i.itemType === "marketplace_listing")!.itemSnapshot as { split: { sellerEarningKobo: number } };
    expect(marketplace.split.sellerEarningKobo).toBe(400_000);
    // Stock 3 is at or below the threshold (5), so the variant is held.
    const holds = await conn.db.select().from(conn.schema.inventoryReservations).where(eq(conn.schema.inventoryReservations.orderId, order.id));
    expect(holds).toMatchObject([{ productVariantId: variantId, quantity: 1, status: "active" }]);
  });

  it("blocks checkout and reports each change without creating an order", async () => {
    const before = await conn.db.$count(conn.schema.orders);
    const result = await initiateCheckout(GUEST, {
      lines: [customLine(2_000_000), variantLine(5)],
      delivery,
      gateway: "paystack",
    });
    expect(result.kind).toBe("changed");
    if (result.kind !== "changed") return;
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "custom", kind: "price_changed", newPriceKobo: 2_305_000 }),
        expect.objectContaining({ key: "variant", kind: "quantity_reduced", newQuantity: 3 }),
      ]),
    );
    expect(await conn.db.$count(conn.schema.orders)).toBe(before);
    expect(formatNaira(2_305_000)).toBe("₦23,050");
  });

  it("won't sell the same last bottles twice", async () => {
    await checkout([variantLine(3)]);
    const second = await initiateCheckout(GUEST, { lines: [variantLine(1)], delivery, gateway: "paystack" });
    expect(second).toMatchObject({ kind: "changed", issues: [expect.objectContaining({ kind: "unavailable" })] });
  });

  it("rejects states outside every shipping zone", async () => {
    await conn.db.update(conn.schema.shippingZones).set({ isActive: false }).where(eq(conn.schema.shippingZones.name, "Rest of Nigeria"));
    try {
      await expect(
        initiateCheckout(GUEST, { lines: [customLine()], delivery: { ...delivery, state: "Kano" }, gateway: "paystack" }),
      ).rejects.toBeInstanceOf(ValidationError);
    } finally {
      await conn.db.update(conn.schema.shippingZones).set({ isActive: true }).where(eq(conn.schema.shippingZones.name, "Rest of Nigeria"));
    }
  });

  it("marks paid once: consumes holds, deducts stock, credits the seller and emails once", async () => {
    const order = await checkout([listingLine(), variantLine(2)]);
    const verification = pay(order.paymentReference!);
    expect(await applyVerifiedPayment(order.paymentReference!, verification, "webhook")).toBe("paid");
    expect(await applyVerifiedPayment(order.paymentReference!, verification, "webhook")).toBe("already_processed");

    const [paid] = await conn.db.select().from(conn.schema.orders).where(eq(conn.schema.orders.id, order.id));
    expect(paid).toMatchObject({ status: "paid", needsAttention: false });
    const [variant] = await conn.db.select().from(conn.schema.productVariants).where(eq(conn.schema.productVariants.id, variantId));
    expect(variant.stockQty).toBe(1);
    const holds = await conn.db.select().from(conn.schema.inventoryReservations).where(eq(conn.schema.inventoryReservations.orderId, order.id));
    expect(holds.map((h) => h.status)).toEqual(["consumed"]);
    const ledger = await conn.db.select().from(conn.schema.sellerEarningsLedger).where(eq(conn.schema.sellerEarningsLedger.orderId, order.id));
    expect(ledger).toMatchObject([{ sellerId, amountKobo: 400_000, status: "pending", entryType: "sale_credit" }]);
    const emails = await conn.db.select().from(conn.schema.emailOutbox).where(eq(conn.schema.emailOutbox.dedupeKey, `order_paid:${order.id}`));
    expect(emails).toHaveLength(1);
    expect(JSON.stringify(emails[0].payload)).not.toContain("Lemon");
  });

  it("never marks paid on an amount mismatch", async () => {
    const order = await checkout([customLine()]);
    const outcome = await applyVerifiedPayment(order.paymentReference!, pay(order.paymentReference!, { reportedKobo: 100 }), "webhook");
    expect(outcome).toBe("amount_mismatch");
    const [row] = await conn.db.select().from(conn.schema.orders).where(eq(conn.schema.orders.id, order.id));
    expect(row).toMatchObject({ status: "pending_payment", needsAttention: true });
  });

  it("a webhook before the redirect return is never undone by the return", async () => {
    const order = await checkout([customLine()]);
    await applyVerifiedPayment(order.paymentReference!, pay(order.paymentReference!), "webhook");
    const status = await pollOrderStatus(order.orderNumber, { actor: GUEST, checkoutOrderId: order.id });
    expect(status).toBe("paid");
  });

  it("a failed payment releases the hold", async () => {
    const order = await checkout([variantLine(1)]);
    expect(await applyVerifiedPayment(order.paymentReference!, pay(order.paymentReference!, { status: "failed" }), "webhook")).toBe("failed");
    const holds = await conn.db.select().from(conn.schema.inventoryReservations).where(eq(conn.schema.inventoryReservations.orderId, order.id));
    expect(holds.map((h) => h.status)).toEqual(["released"]);
    // A later failure report can't move a paid order backwards, and a late success still wins.
    expect(await applyVerifiedPayment(order.paymentReference!, pay(order.paymentReference!), "webhook")).toBe("paid");
    expect(await applyVerifiedPayment(order.paymentReference!, pay(order.paymentReference!, { status: "failed" }), "webhook")).toBe(
      "already_processed",
    );
  });

  it("the processing page verifies directly when the webhook is late", async () => {
    const order = await checkout([customLine()]);
    const access = { actor: GUEST, checkoutOrderId: order.id };
    expect(await pollOrderStatus(order.orderNumber, access)).toBe("verifying_payment");
    pay(order.paymentReference!);
    // Not yet: the webhook gets 20 seconds first.
    expect(await pollOrderStatus(order.orderNumber, access)).toBe("verifying_payment");
    await conn.db
      .update(conn.schema.orders)
      .set({ verifyingSince: new Date(Date.now() - 25_000) })
      .where(eq(conn.schema.orders.id, order.id));
    expect(await pollOrderStatus(order.orderNumber, access)).toBe("paid");
  });

  it("only the buyer's browser, the owner or an admin can poll or view an order", async () => {
    const owner = actorFor(await createUser(conn.db));
    const order = await checkout([customLine()], owner);
    const stranger = actorFor(await createUser(conn.db));
    expect(await pollOrderStatus(order.orderNumber, { actor: stranger, checkoutOrderId: null })).toBeNull();
    expect(await getBuyerOrder(order.orderNumber, { actor: GUEST, checkoutOrderId: null })).toBeNull();
    expect(await getBuyerOrder(order.orderNumber, { actor: owner, checkoutOrderId: null })).not.toBeNull();
    const admin = actorFor(await createUser(conn.db, { role: "admin" }));
    expect(await getBuyerOrder(order.orderNumber, { actor: admin, checkoutOrderId: null })).not.toBeNull();
  });

  it("guest lookup needs both order number and email, and redacts marketplace formulas", async () => {
    const order = await checkout([listingLine()]);
    expect(await lookupOrder(order.orderNumber, "someone@else.com")).toBeNull();
    const view = await lookupOrder(order.orderNumber, "ADAEZE@example.com");
    expect(view?.items[0].view).toMatchObject({ type: "marketplace_listing", creatorName: "Emeka" });
    const json = JSON.stringify(view);
    expect(json).toContain("Iris");
    expect(json).not.toContain("Lemon");
    expect(json).not.toContain(catalog.ing("Amber").id);
    expect(json).not.toContain("14 Victoria Island");
  });

  it("webhooks: bad signatures are rejected, replays are no-ops", async () => {
    const order = await checkout([customLine()]);
    pay(order.paymentReference!);
    const body = JSON.stringify({ event: "charge.success", data: { id: 991, reference: order.paymentReference } });
    const signed = new Headers({ "x-paystack-signature": paystackSignature(body) });

    expect(await handlePaymentWebhook("paystack", body, new Headers({ "x-paystack-signature": "nope" }))).toEqual({ status: 401 });
    expect(await handlePaymentWebhook("paystack", body, signed)).toEqual({ status: 200, outcome: "paid" });
    expect(await handlePaymentWebhook("paystack", body, signed)).toEqual({ status: 200, outcome: "duplicate" });

    const flwBody = JSON.stringify({ event: "charge.completed", data: { id: 5, tx_ref: order.paymentReference, status: "successful" } });
    expect(await handlePaymentWebhook("flutterwave", flwBody, new Headers({ "verif-hash": "wrong" }))).toEqual({ status: 401 });
    expect(await handlePaymentWebhook("flutterwave", flwBody, new Headers({ "verif-hash": "flw-test-hash" }))).toEqual({
      status: 200,
      outcome: "already_processed",
    });
    expect(await getDb().$count(conn.schema.emailOutbox, eq(conn.schema.emailOutbox.dedupeKey, `order_paid:${order.id}`))).toBe(1);
  });
});
