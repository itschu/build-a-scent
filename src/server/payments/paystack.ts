import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { requireEnv } from "@/env";
import { GatewayError, type GatewayClient, type Verification } from "./types";

const API = "https://api.paystack.co";

async function call<T>(path: string, init?: RequestInit): Promise<{ httpStatus: number; body: T }> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${requireEnv("PAYSTACK_SECRET_KEY")}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    signal: AbortSignal.timeout(15_000),
  });
  return { httpStatus: response.status, body: (await response.json().catch(() => ({}))) as T };
}

export function paystackSignature(rawBody: string, secret = requireEnv("PAYSTACK_SECRET_KEY")): string {
  return createHmac("sha512", secret).update(rawBody).digest("hex");
}

export function mapPaystackStatus(status: string): Verification["status"] {
  if (status === "success") return "success";
  if (status === "failed" || status === "abandoned" || status === "reversed") return "failed";
  return "pending";
}

export const paystack: GatewayClient = {
  name: "paystack",

  async initialize(input) {
    const { body } = await call<{ status: boolean; message?: string; data?: { authorization_url: string } }>(
      "/transaction/initialize",
      {
        method: "POST",
        body: JSON.stringify({
          email: input.email,
          amount: input.amountKobo,
          currency: "NGN",
          reference: input.reference,
          callback_url: input.callbackUrl,
          metadata: { order_number: input.orderNumber, customer_name: input.name, phone: input.phone },
        }),
      },
    );
    if (!body.status || !body.data?.authorization_url) {
      throw new GatewayError(`Paystack initialize failed: ${body.message ?? "unknown error"}`);
    }
    return { paymentUrl: body.data.authorization_url };
  },

  async verify(reference) {
    const { httpStatus, body } = await call<{
      status: boolean;
      message?: string;
      data?: { status: string; amount: number; currency: string };
    }>(`/transaction/verify/${encodeURIComponent(reference)}`);
    if (httpStatus === 404 || (httpStatus === 400 && /not found/i.test(body.message ?? ""))) {
      return { status: "not_found", amountKobo: null, currency: null, gatewayStatus: "not_found" };
    }
    if (!body.status || !body.data) throw new GatewayError(`Paystack verify failed: ${body.message ?? httpStatus}`);
    return {
      status: mapPaystackStatus(body.data.status),
      amountKobo: body.data.amount,
      currency: body.data.currency,
      gatewayStatus: body.data.status,
    };
  },

  parseWebhook(rawBody, headers) {
    const given = Buffer.from(headers.get("x-paystack-signature") ?? "");
    const expected = Buffer.from(paystackSignature(rawBody));
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    const payload = JSON.parse(rawBody) as { event?: string; data?: { id?: number | string; reference?: string } };
    if (!payload.event || !payload.data?.reference) return null;
    return { eventId: `${payload.event}:${payload.data.id ?? payload.data.reference}`, reference: payload.data.reference, payload };
  },
};
