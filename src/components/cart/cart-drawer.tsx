"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { create } from "zustand";
import { buttonClasses } from "@/components/ui/button";
import { subtotalKobo } from "@/lib/cart/cart";
import { useCartStore } from "@/lib/cart/store";
import { CartLines } from "./cart-lines";
import { CurrencyToggle, Price, UsdNote } from "./price";

export const useCartDrawer = create<{ open: boolean; setOpen: (open: boolean) => void }>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

export function CartDrawer() {
  const { open, setOpen } = useCartDrawer();
  const lines = useCartStore((s) => s.lines);
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(false), [pathname, setOpen]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70" onMouseDown={() => setOpen(false)}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Your cart"
        tabIndex={-1}
        className="flex h-full w-full max-w-md flex-col border-l border-line bg-surface focus:outline-none"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-5">
          <h2 className="font-serif text-sm uppercase tracking-label text-gold">Your cart</h2>
          <button onClick={() => setOpen(false)} aria-label="Close cart" className="text-xl text-muted hover:text-gold">
            ×
          </button>
        </div>
        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
            <p className="font-serif text-lg text-champagne">Your cart is empty.</p>
            <Link href="/build" className={buttonClasses()}>
              Build a scent
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6">
              <CartLines compact />
            </div>
            <div className="space-y-4 border-t border-line px-6 py-5">
              <div className="flex items-baseline justify-between">
                <span className="font-serif text-xs uppercase tracking-label text-muted">Subtotal</span>
                <Price kobo={subtotalKobo(lines)} className="font-serif text-xl text-gold" />
              </div>
              <div className="flex items-center justify-between">
                <CurrencyToggle />
                <span className="text-xs text-faint">Shipping calculated at checkout</span>
              </div>
              <UsdNote />
              <div className="grid grid-cols-2 gap-3">
                <Link href="/cart" className={buttonClasses({ variant: "ghost" })}>
                  View cart
                </Link>
                <Link href="/checkout" className={buttonClasses()}>
                  Checkout
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
