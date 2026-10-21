import "server-only";
import { env } from "@/env";
import type { PaymentGateway } from "@/lib/domain";
import { fakeGateway } from "./fake";
import { flutterwave } from "./flutterwave";
import { paystack } from "./paystack";
import type { GatewayClient } from "./types";

const clients: Record<PaymentGateway, GatewayClient> = { paystack, flutterwave };

export function getGateway(name: PaymentGateway): GatewayClient {
  const client = clients[name];
  return env().PAYMENTS_MODE === "fake" ? fakeGateway(client) : client;
}

export function isFakePayments(): boolean {
  return env().PAYMENTS_MODE === "fake";
}
