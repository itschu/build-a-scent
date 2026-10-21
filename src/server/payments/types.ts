import type { PaymentGateway } from "@/lib/domain";

export type InitializeInput = {
  reference: string;
  amountKobo: number;
  email: string;
  name: string;
  phone: string;
  orderNumber: string;
  callbackUrl: string;
};

export type VerificationStatus = "success" | "failed" | "pending" | "not_found";

export type Verification = {
  status: VerificationStatus;
  amountKobo: number | null;
  currency: string | null;
  /** The gateway's own status word, kept for the admin review queue. */
  gatewayStatus: string;
};

export type WebhookEvent = { eventId: string; reference: string; payload: unknown };

export interface GatewayClient {
  readonly name: PaymentGateway;
  initialize(input: InitializeInput): Promise<{ paymentUrl: string }>;
  verify(reference: string): Promise<Verification>;
  /** Authenticates and parses a webhook. Returns null when the signature is invalid. */
  parseWebhook(rawBody: string, headers: Headers): WebhookEvent | null;
}

export class GatewayError extends Error {}
