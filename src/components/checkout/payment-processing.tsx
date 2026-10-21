"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { buttonClasses } from "@/components/ui/button";
import { useCartStore } from "@/lib/cart/store";
import type { OrderStatus } from "@/lib/domain";

const POLL_MS = 2_000;
/** After this long without confirmation, stop spinning and explain manual review (Flow 4, step 11). */
const GIVE_UP_MS = 90_000;

type View = "checking" | "failed" | "review" | "missing";

export function PaymentProcessing() {
  const router = useRouter();
  const orderNumber = useSearchParams().get("order");
  const clearCart = useCartStore((s) => s.clearCart);
  const [view, setView] = useState<View>(orderNumber ? "checking" : "missing");

  useEffect(() => {
    if (!orderNumber) return;
    const started = Date.now();
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;

    async function poll() {
      try {
        const response = await fetch(`/api/orders/status?order=${encodeURIComponent(orderNumber!)}`, { cache: "no-store" });
        if (response.status === 404) return !cancelled && setView("missing");
        if (response.ok) {
          const { status } = (await response.json()) as { status: OrderStatus };
          if (cancelled) return;
          if (status === "payment_failed" || status === "cancelled" || status === "expired") return setView("failed");
          if (status !== "pending_payment" && status !== "verifying_payment") {
            clearCart();
            router.replace(`/checkout/confirmation?order=${encodeURIComponent(orderNumber!)}`);
            return;
          }
        }
      } catch {
        // Network hiccup: keep polling until the time limit.
      }
      if (cancelled) return;
      if (Date.now() - started >= GIVE_UP_MS) setView("review");
      else timer = setTimeout(poll, POLL_MS);
    }

    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [orderNumber, router, clearCart]);

  if (view === "checking") {
    return (
      <div role="status" aria-live="polite">
        <span className="mx-auto mb-8 block size-12 animate-spin rounded-full border-2 border-gold-dim border-t-gold" aria-hidden />
        <h1 className="mb-3 font-serif text-3xl text-cream">Confirming your payment…</h1>
        <p className="text-sm text-muted">This usually takes a few seconds. Please don&apos;t close this page.</p>
      </div>
    );
  }

  if (view === "failed") {
    return (
      <div role="alert">
        <h1 className="mb-3 font-serif text-3xl text-cream">Your payment didn&apos;t go through</h1>
        <p className="mb-8 text-sm text-muted">No money was taken for order {orderNumber}. Your cart is still saved.</p>
        <Link href="/checkout" className={buttonClasses({ size: "lg" })}>
          Try again
        </Link>
      </div>
    );
  }

  if (view === "review") {
    return (
      <div role="status">
        <h1 className="mb-3 font-serif text-3xl text-cream">Your payment is being reviewed</h1>
        <p className="mb-2 text-sm text-muted">
          We haven&apos;t received confirmation from the payment provider yet. Our team will confirm it and email you as soon
          as it&apos;s done. You don&apos;t need to pay again.
        </p>
        <p className="mb-8 text-sm text-champagne">
          Your order number is <strong className="text-gold">{orderNumber}</strong>.
        </p>
        <Link href={`/orders/lookup?order=${encodeURIComponent(orderNumber ?? "")}`} className={buttonClasses({ variant: "ghost" })}>
          Check order status
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-3 font-serif text-3xl text-cream">We couldn&apos;t find that order</h1>
      <p className="mb-8 text-sm text-muted">If you&apos;ve paid, look up your order with its number and your email.</p>
      <Link href="/orders/lookup" className={buttonClasses()}>
        Look up an order
      </Link>
    </div>
  );
}
