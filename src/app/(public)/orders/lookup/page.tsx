import type { Metadata } from "next";
import { Suspense } from "react";
import { OrderLookup } from "@/components/orders/order-lookup";

export const metadata: Metadata = { title: "Look up an order · Build a Scent" };

export default function OrderLookupPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-14 sm:px-8">
      <p className="mb-2 font-serif text-[0.7rem] uppercase tracking-display text-gold">Order status</p>
      <h1 className="mb-2 font-serif text-3xl text-cream">Look up an order</h1>
      <p className="mb-8 text-sm text-muted">Enter your order number and the email you used at checkout.</p>
      <Suspense>
        <OrderLookup />
      </Suspense>
    </main>
  );
}
