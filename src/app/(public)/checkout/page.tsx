import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutForm, type CheckoutPrefill } from "@/components/checkout/checkout-form";
import { getActor } from "@/server/auth/session";
import { getCachedPublicSettings, getCachedShippingZones } from "@/server/cached";
import { getOwnProfile } from "@/server/dal/profiles";

export const metadata: Metadata = { title: "Secure checkout · Build a Scent" };

export default function CheckoutPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-8">
      <p className="mb-2 font-serif text-[0.7rem] uppercase tracking-display text-gold">Secure checkout</p>
      <h1 className="mb-8 font-serif text-3xl text-cream">Delivery & payment</h1>
      <Suspense fallback={<p className="text-sm text-muted">Loading checkout…</p>}>
        <Checkout />
      </Suspense>
    </main>
  );
}

async function Checkout() {
  // The session read comes first so cached database reads never run during `next build`.
  const actor = await getActor();
  const [zones, settings] = await Promise.all([getCachedShippingZones(), getCachedPublicSettings()]);
  let prefill: CheckoutPrefill = {};
  if (actor.kind === "user") {
    const p = await getOwnProfile(actor);
    prefill = {
      fullName: p.fullName ?? "",
      email: p.email,
      phone: p.phone ?? "",
      address: p.deliveryAddress ?? "",
      city: p.city ?? "",
      state: p.state ?? "",
    };
  }
  return <CheckoutForm zones={zones} prefill={prefill} leadDays={settings.production_lead_days} />;
}
