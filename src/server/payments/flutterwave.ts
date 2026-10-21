import "server-only";
import { timingSafeEqual } from "node:crypto";
import { requireEnv } from "@/env";
import { GatewayError, type GatewayClient, type Verification } from "./types";

const API = "https://api.flutterwave.com/v3";

async function call<T>(path: string, init?: RequestInit): Promise<{ httpStatus: number; body: T }> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${requireEnv("FLUTTERWAVE_SECRET_KEY")}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    signal: AbortSignal.timeout(15_000),
  });
  return { httpStatus: response.status, body: (await response.json().catch(() => ({}))) as T };
}

export function mapFlutterwaveStatus(status: string): Verification["status"] {
  if (status === "successful") return "success";
  if (status === "failed" || status === "cancelled") return "failed";
  return "pending";
}

export const flutterwave: GatewayClient = {
  name: "flutterwave",

  async initialize(input) {
    const { body } = await call<{ status: string; message?: string; data?: { link: string } }>("/payments", {
      method: "POST",
      body: JSON.stringify({
        tx_ref: input.reference,
        // Flutterwave takes major units.
        amount: (input.amountKobo / 100).toFixed(2),
        currency: "NGN",
        redirect_url: input.callbackUrl,
        customer: { email: input.email, name: input.name, phonenumber: input.phone },
        customizations: { title: "Build a Scent", description: `Order ${input.orderNumber}` },
        meta: { order_number: input.orderNumber },
      }),
    });
    if (body.status !== "success" || !body.data?.link) {
      throw new GatewayError(`Flutterwave initialize failed: ${body.message ?? "unknown error"}`);
    }
    return { paymentUrl: body.data.link };
  },

  async verify(reference) {
    const { httpStatus, body } = await call<{
      status: string;
      message?: string;
      data?: { status: string; amount: number; currency: string };
    }>(`/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`);
    if (httpStatus === 404 || /no transaction was found/i.test(body.message ?? "")) {
      return { status: "not_found", amountKobo: null, currency: null, gatewayStatus: "not_found" };
    }
    if (body.status !== "success" || !body.data) throw new GatewayError(`Flutterwave verify failed: ${body.message ?? httpStatus}`);
    return {
      status: mapFlutterwaveStatus(body.data.status),
      amountKobo: Math.round(body.data.amount * 100),
      currency: body.data.currency,
      gatewayStatus: body.data.status,
    };
  },

  parseWebhook(rawBody, headers) {
    // Flutterwave sends the secret hash configured in its dashboard in `verif-hash`.
    const given = Buffer.from(headers.get("verif-hash") ?? "");
    const expected = Buffer.from(requireEnv("FLUTTERWAVE_WEBHOOK_HASH"));
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    const payload = JSON.parse(rawBody) as { event?: string; data?: { id?: number | string; tx_ref?: string } };
    if (!payload.event || !payload.data?.tx_ref) return null;
    return { eventId: `${payload.event}:${payload.data.id ?? payload.data.tx_ref}`, reference: payload.data.tx_ref, payload };
  },
};
