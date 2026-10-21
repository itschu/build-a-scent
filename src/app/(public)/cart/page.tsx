import type { Metadata } from "next";
import { CartView } from "@/components/cart/cart-view";

export const metadata: Metadata = { title: "Your cart · Build a Scent" };

export default function CartPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-8">
      <p className="mb-2 font-serif text-[0.7rem] uppercase tracking-display text-gold">Cart</p>
      <h1 className="mb-8 font-serif text-3xl text-cream">Review your order</h1>
      <CartView />
    </main>
  );
}
