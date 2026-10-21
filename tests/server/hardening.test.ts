import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { setEmailTransportForTests } from "@/server/email";
import { initiateCheckout } from "@/server/checkout/initiate";
import { pollOrderStatus } from "@/server/checkout/status";
import { GUEST } from "@/server/dal/actor";
import { getPublicListing, submitListing } from "@/server/dal/marketplace";
import { approveListing } from "@/server/dal/moderation";
import { saveScent } from "@/server/dal/scents";
import { expireStalePendingOrders, MANUAL_REVIEW_AFTER_MS, pruneRateLimits, releaseExpiredReservations, retryEmails, reverifyStuckPayments, AUTO_VERIFY_FOR_MS } from "@/server/jobs";
import { fakeTransactions } from "@/server/payments/fake";
import { paystackSignature } from "@/server/payments/paystack";
import { handlePaymentWebhook } from "@/server/payments/webhooks";
import { rateLimit } from "@/server/rate-limit";
import { seed } from "../../scripts/seed-data";
import { loadCatalog } from "../support/catalog";
import { freshTestDatabase, testDatabaseUrl } from "../support/db";
import { actorFor, createUser } from "../support/factories";

type Connection = Awaited<ReturnType<typeof freshTestDatabase>>;

describe.skipIf(!testDatabaseUrl)("launch hardening", () => {
  let conn: Connection;
  let catalog: Awaited<ReturnType<typeof loadCatalog>>;
  let listingId: string;
  let variantId: string;
  let sendFails = false;
  const sent: string[] = [];

  beforeAll(async () => {
    conn = await freshTestDatabase();
    await seed(conn.db, { sampleData: true });
    catalog = await loadCatalog(conn.db);
    setEmailTransportForTests({
      sendMail: async (m: { subject: string }) => {
        if (sendFails) throw new Error("SMTP down");
        sent.push(m.subject);
        return {};
      },
    } as never);
    const admin = actorFor(await createUser(conn.db, { role: "admin" }));
    const seller = actorFor(await createUser(conn.db));
    const { id: scentId } = await saveScent(seller, { name: "Concurrency", formula: ["Oud", "Rose", "Mint"].map(catalog.entry), bottleOptionId: catalog.bottle(50, "spray").id });
    ({ id: listingId } = await submitListing(seller, { scentId, description: "", creatorMarkupKobo: 500_000, featuredIngredientIds: [] }));
    await approveListing(admin, listingId);
    const [variant] = await conn.db.select().from(conn.schema.productVariants).where(eq(conn.schema.productVariants.sizeLabel, "100ml"));
    variantId = variant.id; // stock 3: at/below the hold threshold
  });

  beforeEach(async () => {
    // Each test starts with 3 bottles and no holds, so checkouts hold stock (threshold 5).
    await conn.db.update(conn.schema.productVariants).set({ stockQty: 3 }).where(eq(conn.schema.productVariants.id, variantId));
    await conn.db.update(conn.schema.inventoryReservations).set({ status: "released" }).where(eq(conn.schema.inventoryReservations.status, "active"));
  });

  afterAll(async () => {
    setEmailTransportForTests(undefined);
    await conn?.close();
  });

  const delivery = { fullName: "Ada", email: "ada@example.com", phone: "08030000000", address: "1 Marina", city: "Lagos", state: "Lagos" as const };

  async function checkout() {
    const listing = (await getPublicListing(listingId))!;
    const [variant] = await conn.db.select().from(conn.schema.productVariants).where(eq(conn.schema.productVariants.id, variantId));
    const result = await initiateCheckout(GUEST, {
      lines: [
        { type: "marketplace_listing", key: "l", listingId, quantity: 1, displayPriceKobo: listing.buyerPriceKobo },
        { type: "standard_product", key: "v", variantId, quantity: 1, displayPriceKobo: variant.priceKobo },
      ],
      delivery,
      gateway: "paystack",
    });
    if (result.kind !== "ready") throw new Error(JSON.stringify(result));
    const [order] = await conn.db.select().from(conn.schema.orders).where(eq(conn.schema.orders.id, result.orderId));
    return order;
  }

  function webhook(reference: string, eventId: number) {
    const body = JSON.stringify({ event: "charge.success", data: { id: eventId, reference } });
    return handlePaymentWebhook("paystack", body, new Headers({ "x-paystack-signature": paystackSignature(body) }));
  }

  it("concurrent and replayed webhooks pay an order exactly once", async () => {
    const order = await checkout();
    const [stockBefore] = await conn.db.select().from(conn.schema.productVariants).where(eq(conn.schema.productVariants.id, variantId));
    fakeTransactions.get(order.paymentReference!)!.status = "success";

    // The same event five times at once, two different events for the same payment, and the
    // customer's return poll racing them.
    const results = await Promise.all([
      ...Array.from({ length: 5 }, () => webhook(order.paymentReference!, 1)),
      webhook(order.paymentReference!, 2),
      pollOrderStatus(order.orderNumber, { actor: GUEST, checkoutOrderId: order.id }),
    ]);
    expect(results.filter((r) => typeof r === "object" && r !== null && "outcome" in r && r.outcome === "paid")).toHaveLength(1);

    const [paid] = await conn.db.select().from(conn.schema.orders).where(eq(conn.schema.orders.id, order.id));
    expect(paid.status).toBe("paid");
    const [stockAfter] = await conn.db.select().from(conn.schema.productVariants).where(eq(conn.schema.productVariants.id, variantId));
    expect(stockAfter.stockQty).toBe(stockBefore.stockQty - 1);
    expect(await conn.db.$count(conn.schema.sellerEarningsLedger, eq(conn.schema.sellerEarningsLedger.orderId, order.id))).toBe(1);
    expect(await conn.db.$count(conn.schema.emailOutbox, eq(conn.schema.emailOutbox.dedupeKey, `order_paid:${order.id}`))).toBe(1);
    const holds = await conn.db.select().from(conn.schema.inventoryReservations).where(eq(conn.schema.inventoryReservations.orderId, order.id));
    expect(holds.map((h) => h.status)).toEqual(["consumed"]);
    expect(await conn.db.$count(conn.schema.webhookEvents)).toBe(2);
  });

  it("releases expired holds", async () => {
    const order = await checkout();
    await conn.db
      .update(conn.schema.inventoryReservations)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(conn.schema.inventoryReservations.orderId, order.id));
    expect(await releaseExpiredReservations()).toBe(1);
    expect(await releaseExpiredReservations()).toBe(0);
  });

  it("expires abandoned checkouts, but recovers ones the gateway says were paid", async () => {
    const abandoned = await checkout();
    const paidSilently = await checkout();
    fakeTransactions.delete(abandoned.paymentReference!); // never reached the gateway
    fakeTransactions.get(paidSilently.paymentReference!)!.status = "success"; // webhook lost
    const old = new Date(Date.now() - 2 * 60 * 60_000);
    for (const o of [abandoned, paidSilently]) {
      await conn.db.update(conn.schema.orders).set({ createdAt: old }).where(eq(conn.schema.orders.id, o.id));
    }
    const result = await expireStalePendingOrders();
    expect(result).toMatchObject({ expired: 1, recovered: 1 });
    const status = async (id: string) => (await conn.db.select().from(conn.schema.orders).where(eq(conn.schema.orders.id, id)))[0].status;
    expect(await status(abandoned.id)).toBe("expired");
    expect(await status(paidSilently.id)).toBe("paid");
    const holds = await conn.db.select().from(conn.schema.inventoryReservations).where(eq(conn.schema.inventoryReservations.orderId, abandoned.id));
    expect(holds.every((h) => h.status === "released")).toBe(true);
    // Running again (or concurrently) changes nothing.
    expect(await expireStalePendingOrders()).toEqual({ expired: 0, recovered: 0 });
  });

  it("re-verifies stuck payments, emails the customer once, and flags after 24 hours", async () => {
    const stuck = await checkout();
    const veryStuck = await checkout();
    await conn.db
      .update(conn.schema.orders)
      .set({ status: "verifying_payment", verifyingSince: new Date(Date.now() - MANUAL_REVIEW_AFTER_MS - 60_000) })
      .where(eq(conn.schema.orders.id, stuck.id));
    await conn.db
      .update(conn.schema.orders)
      .set({ status: "verifying_payment", verifyingSince: new Date(Date.now() - AUTO_VERIFY_FOR_MS - 60_000) })
      .where(eq(conn.schema.orders.id, veryStuck.id));

    const first = await reverifyStuckPayments();
    expect(first).toMatchObject({ checked: 1, resolved: 0, flagged: 1, emailed: 2 });
    expect(await conn.db.$count(conn.schema.emailOutbox, eq(conn.schema.emailOutbox.dedupeKey, `payment_under_review:${stuck.id}`))).toBe(1);

    // The payment lands; the next run (after the 5-minute spacing) confirms it.
    fakeTransactions.get(stuck.paymentReference!)!.status = "success";
    await conn.db.update(conn.schema.orders).set({ lastVerifyAt: new Date(Date.now() - 6 * 60_000) }).where(eq(conn.schema.orders.id, stuck.id));
    const second = await reverifyStuckPayments();
    expect(second).toMatchObject({ checked: 1, resolved: 1, flagged: 0, emailed: 0 }); // already told once
    const [paid] = await conn.db.select().from(conn.schema.orders).where(eq(conn.schema.orders.id, stuck.id));
    expect(paid.status).toBe("paid");
    const [flagged] = await conn.db.select().from(conn.schema.orders).where(eq(conn.schema.orders.id, veryStuck.id));
    expect(flagged).toMatchObject({ needsAttention: true, attentionReason: "No payment confirmation after 24 hours of automatic checks." });
  });

  it("retries failed emails once their backoff has passed", async () => {
    sendFails = true;
    const order = await checkout();
    fakeTransactions.get(order.paymentReference!)!.status = "success";
    await webhook(order.paymentReference!, 99);
    sendFails = false;
    const [row] = await conn.db.select().from(conn.schema.emailOutbox).where(eq(conn.schema.emailOutbox.dedupeKey, `order_paid:${order.id}`));
    expect(row.status).toBe("failed");
    expect(await retryEmails()).toEqual({ sent: 0, failed: 0 }); // backoff not elapsed
    await conn.db.update(conn.schema.emailOutbox).set({ nextAttemptAt: new Date(Date.now() - 1000) }).where(eq(conn.schema.emailOutbox.id, row.id));
    expect((await retryEmails()).sent).toBeGreaterThanOrEqual(1);
  });

  it("rate limits per key and window, and prunes old windows", async () => {
    const results = [];
    for (let i = 0; i < 4; i++) results.push((await rateLimit("test:key", 3, 60)).allowed);
    expect(results).toEqual([true, true, true, false]);
    expect((await rateLimit("test:other", 3, 60)).allowed).toBe(true);
    await conn.db
      .update(conn.schema.rateLimits)
      .set({ windowStart: new Date(Date.now() - 61_000) })
      .where(eq(conn.schema.rateLimits.key, "test:key"));
    expect((await rateLimit("test:key", 3, 60)).allowed).toBe(true);
    await conn.db.update(conn.schema.rateLimits).set({ windowStart: new Date(Date.now() - 2 * 86_400_000) });
    expect(await pruneRateLimits()).toBeGreaterThanOrEqual(2);
  });
});
