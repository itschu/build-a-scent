import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { OrderSummary } from "@/components/orders/order-summary";
import { buttonClasses } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { getActor } from "@/server/auth/session";
import { listOwnOrders } from "@/server/dal/orders";

export const metadata: Metadata = { title: "Your orders · Build a Scent" };

export default function AccountOrdersPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-8">
      <Eyebrow>Account</Eyebrow>
      <h1 className="mb-8 font-serif text-3xl text-cream">Your orders</h1>
      <Suspense fallback={<p className="text-sm text-muted">Loading your orders…</p>}>
        <Orders />
      </Suspense>
    </main>
  );
}

async function Orders() {
  const orders = await listOwnOrders(await getActor());
  if (orders.length === 0) {
    return (
      <div className="border border-dashed border-line px-6 py-16 text-center">
        <p className="mb-6 font-serif text-lg text-champagne">You haven&apos;t placed any orders yet.</p>
        <Link href="/build" className={buttonClasses()}>
          Build a scent
        </Link>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {orders.map((order) => (
        <OrderSummary key={order.orderNumber} order={order} />
      ))}
    </div>
  );
}
