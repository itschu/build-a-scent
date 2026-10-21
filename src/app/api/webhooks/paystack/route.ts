import { handlePaymentWebhook } from "@/server/payments/webhooks";

export async function POST(request: Request) {
  try {
    const result = await handlePaymentWebhook("paystack", await request.text(), request.headers);
    return Response.json({ received: result.status === 200, outcome: result.outcome }, { status: result.status });
  } catch (error) {
    // A 5xx makes the gateway redeliver; the event is reprocessed because it wasn't marked done.
    console.error("paystack webhook failed", error);
    return Response.json({ received: false }, { status: 500 });
  }
}
