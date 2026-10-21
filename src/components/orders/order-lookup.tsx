"use client";

import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import type { BuyerOrderView } from "@/server/dal/orders";
import { OrderSummaryClient } from "./order-summary-client";

export function OrderLookup() {
  const initialOrder = useSearchParams().get("order") ?? "";
  const [order, setOrder] = useState<BuyerOrderView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/orders/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber: form.get("orderNumber"), email: form.get("email") }),
      });
      const body = (await response.json()) as { order?: BuyerOrderView; error?: string };
      if (response.status === 429) setError("Too many attempts. Please wait a few minutes and try again.");
      else if (!response.ok || !body.order) setError(body.error ?? "We couldn't find that order.");
      setOrder(body.order ?? null);
    } catch {
      setError("We couldn't reach the server. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-10">
      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end" noValidate>
        <Field label="Order number">
          {({ id }) => <Input id={id} name="orderNumber" defaultValue={initialOrder} placeholder="BAS-7K3M9Q" required />}
        </Field>
        <Field label="Email">{({ id }) => <Input id={id} name="email" type="email" autoComplete="email" required />}</Field>
        <Button type="submit" pending={pending}>
          Find order
        </Button>
      </form>
      {error && <Notice tone="error">{error}</Notice>}
      {order && (
        <>
          {order.status === "verifying_payment" && (
            <Notice>We&apos;re still verifying your payment with the payment provider. We&apos;ll email you once it&apos;s confirmed.</Notice>
          )}
          <OrderSummaryClient order={order} />
        </>
      )}
    </div>
  );
}
