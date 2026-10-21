import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { OrderSummary } from "@/components/orders/order-summary";
import { BottleVisual } from "@/components/scent/bottle-visual";
import { buttonClasses } from "@/components/ui/button";
import { getActor } from "@/server/auth/session";
import { checkoutContextOrderId } from "@/server/checkout/context";
import { normalizeOrderNumber } from "@/server/checkout/order-number";
import { getBuyerOrder } from "@/server/dal/orders";

export const metadata: Metadata = { title: "Order confirmed · Build a Scent", robots: { index: false } };

export default function ConfirmationPage({ searchParams }: PageProps<"/checkout/confirmation">) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-14 sm:px-8">
      <Suspense fallback={<p className="text-sm text-muted">Loading your order…</p>}>
        <Confirmation searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Confirmation({ searchParams }: { searchParams: PageProps<"/checkout/confirmation">["searchParams"] }) {
  const params = await searchParams;
  const orderNumber = typeof params.order === "string" ? normalizeOrderNumber(params.order) : null;
  const order = orderNumber
    ? await getBuyerOrder(orderNumber, { actor: await getActor(), checkoutOrderId: await checkoutContextOrderId() })
    : null;

  if (!order) {
    return (
      <div className="py-16 text-center">
        <h1 className="mb-4 font-serif text-2xl text-cream">We can&apos;t show this order here</h1>
        <p className="mb-8 text-sm text-muted">Look it up with your order number and the email you used at checkout.</p>
        <Link href="/orders/lookup" className={buttonClasses()}>
          Look up an order
        </Link>
      </div>
    );
  }

  const hero = order.items.find((i) => i.view.type !== "standard_product")?.view;
  return (
    <div>
      <div className="mb-10 text-center">
        {hero && hero.type !== "standard_product" && (
          <BottleVisual layers={hero.colors} className="mx-auto mb-6 h-56" label={hero.name} />
        )}
        <p className="mb-2 font-serif text-[0.7rem] uppercase tracking-display text-gold">Thank you</p>
        <h1 className="mb-3 font-serif text-4xl text-cream">Your order is confirmed</h1>
        <p className="text-sm text-muted">
          Order <span className="text-gold">{order.orderNumber}</span>. A confirmation email is on its way.
        </p>
      </div>
      <OrderSummary order={order} />
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/build" className={buttonClasses()}>
          Build another scent
        </Link>
        <Link href={`/orders/lookup?order=${order.orderNumber}`} className={buttonClasses({ variant: "ghost" })}>
          Track this order
        </Link>
      </div>
    </div>
  );
}
