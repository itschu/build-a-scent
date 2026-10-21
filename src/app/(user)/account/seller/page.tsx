import type { Metadata } from "next";
import { Suspense } from "react";
import { SellerDashboard } from "@/components/marketplace/seller-dashboard";
import { Eyebrow } from "@/components/ui/eyebrow";
import { getActor } from "@/server/auth/session";
import { getSellerDashboard } from "@/server/dal/marketplace";

export const metadata: Metadata = { title: "Seller dashboard · Build a Scent" };

export default function SellerPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-8">
      <Eyebrow>Marketplace</Eyebrow>
      <h1 className="mb-8 font-serif text-3xl text-cream">Seller dashboard</h1>
      <Suspense fallback={<p className="text-sm text-muted">Loading your listings…</p>}>
        <Dashboard />
      </Suspense>
    </main>
  );
}

async function Dashboard() {
  const data = await getSellerDashboard(await getActor());
  return <SellerDashboard {...data} />;
}
