import "server-only";
import { and, eq, gt, isNull, lt, lte, or, sql } from "drizzle-orm";
import { env } from "@/env";
import { getDb, schema } from "@/server/db";
import { deliverEmail, deliverEmails, dueEmailIds, queueEmail } from "@/server/email";
import { getGateway } from "@/server/payments";
import { applyVerifiedPayment, releaseReservations } from "@/server/payments/apply";
import { getSettings } from "@/server/settings";

// Background jobs, run every 5 minutes by the Railway cron service (`pnpm jobs:run`). Every job
// is idempotent and safe to run concurrently: rows are claimed with FOR UPDATE SKIP LOCKED or
// changed by single guarded statements.

const BATCH = 50;
/** An order this long in verifying_payment counts as "in manual review" (customer is emailed). */
export const MANUAL_REVIEW_AFTER_MS = 10 * 60_000;
/** Automatic re-verification stops after this; only manual review remains. */
export const AUTO_VERIFY_FOR_MS = 24 * 60 * 60_000;
const REVERIFY_EVERY_MS = 5 * 60_000;

/** Frees low-stock holds whose checkout never completed. */
export async function releaseExpiredReservations(): Promise<number> {
  const released = await getDb()
    .update(schema.inventoryReservations)
    .set({ status: "released" })
    .where(and(eq(schema.inventoryReservations.status, "active"), lte(schema.inventoryReservations.expiresAt, new Date())))
    .returning({ id: schema.inventoryReservations.id });
  return released.length;
}

/**
 * Checks `ids` out of a status for processing: only rows still matching `where` are returned,
 * and their verification time is bumped so a concurrent runner skips them.
 */
async function claimOrders(where: ReturnType<typeof and>) {
  return getDb().transaction(async (tx) => {
    const rows = await tx
      .select({
        id: schema.orders.id,
        reference: schema.orders.paymentReference,
        gateway: schema.orders.paymentGateway,
      })
      .from(schema.orders)
      .where(where)
      .limit(BATCH)
      .for("update", { skipLocked: true });
    for (const row of rows) {
      await tx.update(schema.orders).set({ lastVerifyAt: new Date() }).where(eq(schema.orders.id, row.id));
    }
    return rows;
  });
}

/**
 * Unpaid checkouts past the payment window: ask the gateway first (a lost webhook must not
 * lose a real payment), then expire the rest and release their holds.
 */
export async function expireStalePendingOrders(): Promise<{ expired: number; recovered: number }> {
  const { payment_window_minutes } = await getSettings();
  const cutoff = new Date(Date.now() - payment_window_minutes * 60_000);
  const recentlyChecked = new Date(Date.now() - REVERIFY_EVERY_MS);
  const candidates = await claimOrders(
    and(
      eq(schema.orders.status, "pending_payment"),
      lt(schema.orders.createdAt, cutoff),
      or(isNull(schema.orders.lastVerifyAt), lt(schema.orders.lastVerifyAt, recentlyChecked)),
    ),
  );
  let expired = 0;
  let recovered = 0;
  for (const order of candidates) {
    if (!order.reference) continue;
    try {
      const verification = await getGateway(order.gateway).verify(order.reference);
      if (verification.status === "success" || verification.status === "failed") {
        const outcome = await applyVerifiedPayment(order.reference, verification, "job");
        if (outcome === "paid") recovered++;
        continue;
      }
    } catch (error) {
      console.error(`[jobs] verify failed for ${order.reference}`, error);
      continue; // try again next run rather than expiring an order we couldn't check
    }
    await getDb().transaction(async (tx) => {
      const updated = await tx
        .update(schema.orders)
        .set({ status: "expired" })
        .where(and(eq(schema.orders.id, order.id), eq(schema.orders.status, "pending_payment")))
        .returning({ id: schema.orders.id });
      if (updated.length) {
        await releaseReservations(tx, order.id);
        expired++;
      }
    });
  }
  return { expired, recovered };
}

/**
 * Orders stuck in verifying_payment: re-verify every 5 minutes for 24 hours. When an order
 * first enters manual review the customer is told; after 24 hours it is flagged for an admin.
 */
export async function reverifyStuckPayments(): Promise<{ checked: number; resolved: number; flagged: number; emailed: number }> {
  const now = Date.now();
  const db = getDb();
  const stats = { checked: 0, resolved: 0, flagged: 0, emailed: 0 };

  // Customers whose payment is now in manual review get one "we're checking" email.
  const reviewing = await db
    .select()
    .from(schema.orders)
    .where(and(eq(schema.orders.status, "verifying_payment"), lt(schema.orders.verifyingSince, new Date(now - MANUAL_REVIEW_AFTER_MS))))
    .limit(BATCH);
  const emailIds = [];
  for (const order of reviewing) {
    const id = await queueEmail(db, {
      dedupeKey: `payment_under_review:${order.id}`,
      to: order.email,
      template: "payment_under_review",
      payload: {
        name: order.deliveryAddress.fullName,
        orderNumber: order.orderNumber,
        lookupUrl: `${env().APP_URL}/orders/lookup?order=${order.orderNumber}`,
      },
    });
    if (id) {
      emailIds.push(id);
      stats.emailed++;
    }
  }
  await deliverEmails(emailIds);

  const due = await claimOrders(
    and(
      eq(schema.orders.status, "verifying_payment"),
      lt(schema.orders.verifyingSince, new Date(now - MANUAL_REVIEW_AFTER_MS)),
      gt(schema.orders.verifyingSince, new Date(now - AUTO_VERIFY_FOR_MS)),
      or(isNull(schema.orders.lastVerifyAt), lt(schema.orders.lastVerifyAt, new Date(now - REVERIFY_EVERY_MS))),
    ),
  );
  for (const order of due) {
    if (!order.reference) continue;
    stats.checked++;
    try {
      const verification = await getGateway(order.gateway).verify(order.reference);
      const outcome = await applyVerifiedPayment(order.reference, verification, "job");
      if (outcome === "paid" || outcome === "failed") stats.resolved++;
    } catch (error) {
      console.error(`[jobs] verify failed for ${order.reference}`, error);
    }
  }

  const flagged = await db
    .update(schema.orders)
    .set({ needsAttention: true, attentionReason: "No payment confirmation after 24 hours of automatic checks." })
    .where(
      and(
        eq(schema.orders.status, "verifying_payment"),
        eq(schema.orders.needsAttention, false),
        lte(schema.orders.verifyingSince, new Date(now - AUTO_VERIFY_FOR_MS)),
      ),
    )
    .returning({ id: schema.orders.id });
  stats.flagged = flagged.length;
  return stats;
}

/** Retries failed or never-sent emails whose backoff has elapsed. */
export async function retryEmails(): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  for (const id of await dueEmailIds()) {
    const result = await deliverEmail(id);
    if (result === "sent") sent++;
    else if (result === "failed") failed++;
  }
  return { sent, failed };
}

/** Drops rate-limit windows older than a day. */
export async function pruneRateLimits(): Promise<number> {
  const deleted = await getDb()
    .delete(schema.rateLimits)
    .where(lt(schema.rateLimits.windowStart, sql`now() - interval '1 day'`))
    .returning({ key: schema.rateLimits.key });
  return deleted.length;
}

export async function runAllJobs() {
  const results: Record<string, unknown> = {};
  for (const [name, job] of Object.entries({
    releaseExpiredReservations,
    expireStalePendingOrders,
    reverifyStuckPayments,
    retryEmails,
    pruneRateLimits,
  })) {
    // One failing job must not stop the others.
    try {
      results[name] = await job();
    } catch (error) {
      console.error(`[jobs] ${name} failed`, error);
      results[name] = { error: error instanceof Error ? error.message : String(error) };
    }
  }
  return results;
}
