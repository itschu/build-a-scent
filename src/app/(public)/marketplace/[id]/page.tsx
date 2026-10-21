/* eslint-disable @next/next/no-img-element -- creator avatars are arbitrary https URLs */
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AddListingToCart } from "@/components/marketplace/add-listing-to-cart";
import { NoteProfileList } from "@/components/marketplace/note-profile-list";
import { BottleVisual } from "@/components/scent/bottle-visual";
import { buttonClasses } from "@/components/ui/button";
import { getPublicListing } from "@/server/dal/marketplace";

export async function generateMetadata({ params }: PageProps<"/marketplace/[id]">): Promise<Metadata> {
  const listing = await getPublicListing((await params).id);
  return listing
    ? { title: `${listing.name} by ${listing.creatorName} · Build a Scent`, description: listing.description || undefined }
    : { title: "Unavailable · Build a Scent" };
}

export default function ListingPage({ params }: PageProps<"/marketplace/[id]">) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-8">
      <Link href="/marketplace" className="mb-8 inline-block text-xs text-muted hover:text-gold">
        ← Back to the marketplace
      </Link>
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
        <Listing params={params} />
      </Suspense>
    </main>
  );
}

async function Listing({ params }: { params: PageProps<"/marketplace/[id]">["params"] }) {
  const listing = await getPublicListing((await params).id);
  if (!listing) {
    return (
      <div className="py-16 text-center">
        <h1 className="mb-4 font-serif text-2xl text-cream">This scent is currently unavailable.</h1>
        <Link href="/marketplace" className={buttonClasses({ variant: "ghost" })}>
          Browse other scents
        </Link>
      </div>
    );
  }

  return (
    <div className="grid items-start gap-12 md:grid-cols-[280px_1fr]">
      <BottleVisual layers={listing.layers} className="mx-auto h-80" label={listing.name} />
      <div>
        <p className="mb-2 font-serif text-[0.7rem] uppercase tracking-display text-gold">Community scent</p>
        <h1 className="font-serif text-4xl text-cream">{listing.name}</h1>
        <p className="mt-2 text-sm text-muted">{listing.bottleLabel}</p>
        {listing.description && <p className="mt-6 text-sm leading-relaxed text-champagne">{listing.description}</p>}

        <div className="my-8 border border-line p-5">
          <p className="mb-3 font-serif text-[0.7rem] uppercase tracking-label text-muted">Note profile</p>
          <NoteProfileList profile={listing.profile} className="text-sm" />
          <p className="mt-4 text-xs text-faint">The creator&apos;s exact formula is kept private.</p>
        </div>

        <div className="mb-8 flex items-center gap-4 border-y border-line py-5">
          {listing.creator.avatarUrl ? (
            <img src={listing.creator.avatarUrl} alt="" className="size-12 rounded-full object-cover" />
          ) : (
            <span className="flex size-12 items-center justify-center rounded-full border border-gold-dim font-serif text-gold">
              {listing.creator.displayName.charAt(0)}
            </span>
          )}
          <div>
            <p className="text-sm text-champagne">Created by {listing.creator.displayName}</p>
            {listing.creator.bio && <p className="text-xs text-muted">{listing.creator.bio}</p>}
          </div>
        </div>

        <AddListingToCart
          listing={{
            id: listing.id,
            name: listing.name,
            creatorName: listing.creatorName,
            bottleLabel: listing.bottleLabel,
            buyerPriceKobo: listing.buyerPriceKobo,
            layers: listing.layers,
          }}
        />
      </div>
    </div>
  );
}
