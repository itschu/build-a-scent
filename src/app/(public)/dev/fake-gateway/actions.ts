"use server";

import { redirect } from "next/navigation";
import { env } from "@/env";
import { isFakePayments } from "@/server/payments";
import { fakeTransactions } from "@/server/payments/fake";
import { paystackSignature } from "@/server/payments/paystack";

export type FakeOutcome = "success" | "failed" | "success_no_webhook" | "wrong_amount";

/** Simulates the hosted payment page: records the result, sends a signed webhook, returns the customer. */
export async function completeFakePayment(reference: string, outcome: FakeOutcome) {
  if (!isFakePayments()) throw new Error("Fake payments are disabled");
  const tx = fakeTransactions.get(reference);
  if (!tx) throw new Error("Unknown fake transaction");

  tx.status = outcome === "failed" ? "failed" : "success";
  tx.reportedKobo = outcome === "wrong_amount" ? tx.amountKobo - 100 : tx.amountKobo;

  if (outcome !== "success_no_webhook") {
    const id = Date.now();
    const body =
      tx.gateway === "paystack"
        ? JSON.stringify({ event: outcome === "failed" ? "charge.failed" : "charge.success", data: { id, reference } })
        : JSON.stringify({ event: "charge.completed", data: { id, tx_ref: reference, status: outcome === "failed" ? "failed" : "successful" } });
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (tx.gateway === "paystack") headers["x-paystack-signature"] = paystackSignature(body);
    else headers["verif-hash"] = env().FLUTTERWAVE_WEBHOOK_HASH ?? "";
    await fetch(new URL(`/api/webhooks/${tx.gateway}`, env().APP_URL), { method: "POST", headers, body });
  }

  const back = new URL(tx.callbackUrl);
  back.searchParams.set(tx.gateway === "paystack" ? "reference" : "tx_ref", reference);
  redirect(back.toString());
}
