import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import type { OrderStatus } from "@/lib/domain";
import { getDb, schema } from "@/server/db";
import { canViewOrder, findOrderByNumber, type OrderAccess } from "@/server/dal/orders";
import { getGateway } from "@/server/payments";
import { applyVerifiedPayment } from "@/server/payments/apply";

/** After this long without a webhook, the status endpoint asks the gateway directly. */
const VERIFY_AFTER_MS = 20_000;
/** At most one direct verification per order in this window. */
const VERIFY_THROTTLE_MS = 30_000;

/**
 * Polled by the processing page. The first poll marks the customer's return from the gateway
 * (pending_payment → verifying_payment); later polls may verify server-to-server if the
 * webhook is late. Never trusts the redirect itself.
 */
export async function pollOrderStatus(orderNumber: string, access: OrderAccess): Promise<OrderStatus | null> {
  const db = getDb();
  let order = await findOrderByNumber(orderNumber);
  if (!order || !canViewOrder(order, access)) return null;

  if (order.status === "pending_payment") {
    await db
      .update(schema.orders)
      .set({ status: "verifying_payment", verifyingSince: new Date() })
      .where(and(eq(schema.orders.id, order.id), eq(schema.orders.status, "pending_payment")));
    order = (await findOrderByNumber(orderNumber))!;
  }

  const now = Date.now();
  if (
    order.status === "verifying_payment" &&
    order.paymentReference &&
    order.verifyingSince &&
    now - order.verifyingSince.getTime() >= VERIFY_AFTER_MS &&
    (!order.lastVerifyAt || now - order.lastVerifyAt.getTime() >= VERIFY_THROTTLE_MS)
  ) {
    // Compare-and-set claim, so concurrent polls don't all call the gateway.
    const claimed = await db
      .update(schema.orders)
      .set({ lastVerifyAt: new Date() })
      .where(
        and(
          eq(schema.orders.id, order.id),
          order.lastVerifyAt ? eq(schema.orders.lastVerifyAt, order.lastVerifyAt) : isNull(schema.orders.lastVerifyAt),
        ),
      )
      .returning({ id: schema.orders.id });
    if (claimed.length > 0) {
      try {
        const verification = await getGateway(order.paymentGateway).verify(order.paymentReference);
        await applyVerifiedPayment(order.paymentReference, verification, "return");
      } catch (error) {
        console.error("Payment verification failed", error);
      }
      order = (await findOrderByNumber(orderNumber))!;
    }
  }

  return order.status;
}
