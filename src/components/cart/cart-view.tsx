"use client";

import Link from "next/link";
import { useEffect } from "react";
import { buttonClasses } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { subtotalKobo } from "@/lib/cart/cart";
import { useCartNotices } from "@/lib/cart/notices-store";
import { useCartStore } from "@/lib/cart/store";
import { usePublicSettings } from "@/hooks/use-public-settings";
import { formatNaira } from "@/lib/money";
import { CHECKOUT_PAUSED_DEFAULT, freeShippingShortfallKobo, minOrderShortfallKobo } from "@/lib/order-rules";
import { CartLines } from "./cart-lines";
import { CurrencyToggle, Price, UsdNote } from "./price";

export function CartView() {
  const { lines, hydrated } = useCartStore();
  const { notices, clear } = useCartNotices();
  const settings = usePublicSettings();

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
            <CartRules subtotal={subtotalKobo(lines)} settings={settings} />
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

/** Store rules that affect this cart: paused checkout, minimum order and free shipping. */
function CartRules({ subtotal, settings }: { subtotal: number; settings: ReturnType<typeof usePublicSettings> }) {
  if (!settings) return <p className="text-xs text-faint">Shipping is calculated at checkout from your delivery state.</p>;
  const toMinimum = minOrderShortfallKobo(subtotal, settings.min_order_kobo);
  const toFreeShipping = freeShippingShortfallKobo(subtotal, settings.free_shipping_threshold_kobo);
  return (
    <div className="space-y-2 text-xs">
      {!settings.checkout_enabled && (
        <Notice tone="error">{settings.checkout_paused_message || CHECKOUT_PAUSED_DEFAULT}</Notice>
      )}
      {toMinimum > 0 && (
        <p className="text-danger">
          Add {formatNaira(toMinimum)} more to reach the {formatNaira(settings.min_order_kobo)} minimum order.
        </p>
      )}
      {settings.free_shipping_threshold_kobo > 0 &&
        (toFreeShipping > 0 ? (
          <p className="text-champagne">Add {formatNaira(toFreeShipping)} more for free shipping.</p>
        ) : (
          <p className="text-gold">Your order ships free.</p>
        ))}
      <p className="text-faint">Shipping is calculated at checkout from your delivery state.</p>
    </div>
  );
}
