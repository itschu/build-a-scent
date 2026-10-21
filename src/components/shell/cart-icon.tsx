"use client";

import Link from "next/link";
import { itemCount } from "@/lib/cart/cart";
import { useCartStore } from "@/lib/cart/store";

export function CartIcon() {
  const count = useCartStore((s) => (s.hydrated ? itemCount(s.lines) : 0));
  return (
    <Link
      href="/cart"
      aria-label={count > 0 ? `Cart, ${count} item${count === 1 ? "" : "s"}` : "Cart"}
      className="relative p-2 text-muted hover:text-gold"
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <path d="M6 7h12l-1 13H7L6 7Z" />
        <path d="M9 7V5a3 3 0 0 1 6 0v2" />
      </svg>
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-gold px-1 text-center text-[0.6rem] leading-4 text-ink">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
