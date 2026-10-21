import "server-only";
import { env } from "@/env";
import type { PaymentGateway } from "@/lib/domain";
import type { GatewayClient, Verification } from "./types";

// Local payment simulator (PAYMENTS_MODE=fake, localhost only). Transactions live in memory;
// /dev/fake-gateway plays the hosted payment page and sends real, signed webhooks.

type FakeTransaction = {
  gateway: PaymentGateway;
  amountKobo: number;
  status: "pending" | "success" | "failed";
  /** Amount the "gateway" reports; differs from amountKobo when simulating a mismatch. */
  reportedKobo: number;
  callbackUrl: string;
};

const globalForFake = globalThis as unknown as { fakeTransactions?: Map<string, FakeTransaction> };
export const fakeTransactions = (globalForFake.fakeTransactions ??= new Map());

export function fakeGateway(real: GatewayClient): GatewayClient {
  return {
    name: real.name,
    parseWebhook: real.parseWebhook,
    async initialize(input) {
      fakeTransactions.set(input.reference, {
        gateway: real.name,
        amountKobo: input.amountKobo,
        reportedKobo: input.amountKobo,
        status: "pending",
        callbackUrl: input.callbackUrl,
      });
      const url = new URL("/dev/fake-gateway", env().APP_URL);
      url.searchParams.set("reference", input.reference);
      return { paymentUrl: url.toString() };
    },
    async verify(reference): Promise<Verification> {
      const tx = fakeTransactions.get(reference);
      if (!tx) return { status: "not_found", amountKobo: null, currency: null, gatewayStatus: "not_found" };
      return { status: tx.status, amountKobo: tx.reportedKobo, currency: "NGN", gatewayStatus: `fake_${tx.status}` };
    },
  };
}
