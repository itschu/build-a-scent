import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BottleVisual } from "@/components/scent/bottle-visual";
import { OrderSharedBlendButton } from "@/components/sharing/order-shared-blend-button";
import { ScentNotes } from "@/components/library/scent-notes";
import { buttonClasses } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Notice } from "@/components/ui/notice";
import { NOTE_TIERS } from "@/lib/domain";
import { TIER_LABELS } from "@/lib/labels";
import { formatNaira } from "@/lib/money";
import { getSharedScent } from "@/server/dal/sharing";

export async function generateMetadata({ params }: PageProps<"/s/[token]">): Promise<Metadata> {
  const scent = await getSharedScent((await params).token);
  return scent
    ? { title: `${scent.name} by ${scent.creatorName} · Build a Scent`, robots: { index: false } }
    : { title: "Shared scent · Build a Scent", robots: { index: false } };
}

export default function SharedScentPage({ params }: PageProps<"/s/[token]">) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-14 sm:px-8">
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
        <SharedScent params={params} />
      </Suspense>
    </main>
  );
}

async function SharedScent({ params }: { params: PageProps<"/s/[token]">["params"] }) {
  const { token } = await params;
  const scent = await getSharedScent(token);

  if (!scent) {
    return (
      <div className="py-20 text-center">
        <h1 className="mb-4 font-serif text-2xl text-cream">This scent is no longer shared.</h1>
        <p className="mb-8 text-sm text-muted">The owner may have turned sharing off. Why not create your own?</p>
        <Link href="/build" className={buttonClasses()}>
          Build your own
        </Link>
      </div>
    );
  }

  return (
    <div className="grid items-start gap-12 md:grid-cols-[260px_1fr]">
      <BottleVisual layers={scent.layers} className="mx-auto h-80" label={scent.name} />
      <div>
        <Eyebrow>Shared blend</Eyebrow>
        <h1 className="font-serif text-4xl text-cream">{scent.name}</h1>
        <p className="mt-2 text-sm text-muted">
          Created by <span className="text-champagne">{scent.creatorName}</span>
          {scent.bottle && ` · ${scent.bottle.label}`}
        </p>

        <div className="my-8 border border-line p-5">
          {scent.kind === "formula" ? (
            <ScentNotes ingredients={scent.ingredients} />
          ) : (
            <dl className="space-y-1.5 text-xs">
              {NOTE_TIERS.map((tier) => (
                <div key={tier} className="flex gap-3">
                  <dt className="w-12 shrink-0 font-serif uppercase tracking-label text-gold">{TIER_LABELS[tier]}</dt>
                  <dd className="text-muted">
                    {[...scent.profile[tier].featured, ...scent.profile[tier].families.map((f) => `${f} accord`)].join(" · ") || "—"}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        {!scent.availability.available ? (
          <Notice>This blend is no longer available to order.</Notice>
        ) : scent.kind === "listed" ? (
          <div className="flex flex-wrap gap-3">
            <Link href={`/marketplace/${scent.listingId}`} className={buttonClasses({ size: "lg" })}>
              View on the marketplace
            </Link>
            <Link href="/build" className={buttonClasses({ variant: "ghost", size: "lg" })}>
              Build your own
            </Link>
          </div>
        ) : (
          <>
            {scent.priceKobo !== null && <p className="mb-6 font-serif text-2xl text-gold">{formatNaira(scent.priceKobo)}</p>}
            <div className="flex flex-wrap gap-3">
              {scent.bottle && scent.priceKobo !== null && (
                <OrderSharedBlendButton
                  name={scent.name}
                  formula={scent.formula}
                  layers={scent.layers}
                  bottle={scent.bottle}
                  priceKobo={scent.priceKobo}
                />
              )}
              <Link href={`/build?share=${token}`} className={buttonClasses({ variant: "ghost", size: "lg" })}>
                Build your own
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
