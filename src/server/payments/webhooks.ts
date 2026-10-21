import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import type { PaymentGateway } from "@/lib/domain";
import { getDb, schema } from "@/server/db";
import { getGateway } from "./index";
import { applyVerifiedPayment, type ApplyOutcome } from "./apply";

export type WebhookResult = { status: 200 | 401 | 400; outcome?: ApplyOutcome | "duplicate" | "ignored" };

/**
 * Handles a payment webhook: authenticate, record the event once, then confirm the
 * transaction with the gateway's verify API and apply it. A replayed event is a no-op;
 * an event whose processing failed is retried when the gateway redelivers it.
 */
export async function handlePaymentWebhook(gatewayName: PaymentGateway, rawBody: string, headers: Headers): Promise<WebhookResult> {
  const gateway = getGateway(gatewayName);
  let event;
  try {
    event = gateway.parseWebhook(rawBody, headers);
  } catch {
    return { status: 400 };
  }
  if (!event) return { status: 401 };

  const db = getDb();
  await db
    .insert(schema.webhookEvents)
    .values({ gateway: gatewayName, eventId: event.eventId, reference: event.reference, payload: event.payload })
    .onConflictDoNothing();
  const [row] = await db
    .select()
    .from(schema.webhookEvents)
    .where(and(eq(schema.webhookEvents.gateway, gatewayName), eq(schema.webhookEvents.eventId, event.eventId)));
  if (row.processedAt) return { status: 200, outcome: "duplicate" };

  const verification = await gateway.verify(event.reference);
  const outcome = await applyVerifiedPayment(event.reference, verification, "webhook");
  await db
    .update(schema.webhookEvents)
    .set({ processedAt: new Date() })
    .where(and(eq(schema.webhookEvents.id, row.id), isNull(schema.webhookEvents.processedAt)));
  return { status: 200, outcome: outcome === "unknown_order" ? "ignored" : outcome };
}
