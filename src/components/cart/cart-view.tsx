"use client";

import Link from "next/link";
import { useEffect } from "react";
import { buttonClasses } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { subtotalKobo } from "@/lib/cart/cart";
import { useCartNotices } from "@/lib/cart/notices-store";
import { useCartStore } from "@/lib/cart/store";
import { CartLines } from "./cart-lines";
import { CurrencyToggle, Price, UsdNote } from "./price";

export function CartView() {
  const { lines, hydrated } = useCartStore();
  const { notices, clear } = useCartNotices();

  // Revalidation notices are shown once, then cleared when leaving the page.
  useEffect(() => clear, [clear]);

  if (!hydrated) return <p className="text-sm text-muted">Loading your cart…</p>;

  return (
    <>
      {notices.length > 0 && (
        <Notice tone="error" className="mb-8">
          <p className="mb-2 font-medium">Some items in your cart changed, so we&apos;ve updated it. Please review before paying:</p>
          <ul className="list-inside list-disc space-y-1">
            {notices.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </Notice>
      )}
      {lines.length === 0 ? (
        <div className="border border-dashed border-line px-6 py-16 text-center">
          <p className="mb-6 font-serif text-lg text-champagne">Your cart is empty.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/build" className={buttonClasses()}>
              Build a scent
            </Link>
            <Link href="/shop" className={buttonClasses({ variant: "ghost" })}>
              Shop collection
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
          <div className="border-y border-line">
            <CartLines />
          </div>
          <aside className="h-fit space-y-5 border border-line bg-coal p-6">
            <div className="flex items-baseline justify-between">
              <span className="font-serif text-xs uppercase tracking-label text-muted">Subtotal</span>
              <Price kobo={subtotalKobo(lines)} className="font-serif text-2xl text-gold" />
            </div>
            <p className="text-xs text-faint">Shipping is calculated at checkout from your delivery state.</p>
            <CurrencyToggle />
            <UsdNote />
            <Link href="/checkout" className={buttonClasses({ size: "lg", variant: "primary" }) + " w-full"}>
              Proceed to checkout
            </Link>
          </aside>
        </div>
      )}
    </>
  );
}
