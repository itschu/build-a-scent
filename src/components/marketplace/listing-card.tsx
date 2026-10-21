import Link from "next/link";
import { BottleVisual } from "@/components/scent/bottle-visual";
import { formatNaira } from "@/lib/money";
import type { PublicListing } from "@/server/dal/marketplace";
import { NoteProfileList } from "./note-profile-list";

export function ListingCard({ listing }: { listing: PublicListing }) {
  return (
    <Link href={`/marketplace/${listing.id}`} className="group flex flex-col border border-line bg-surface transition-colors hover:border-gold-dim">
      <div className="flex h-56 items-center justify-center bg-coal">
        <BottleVisual layers={listing.layers} className="h-44 transition-transform duration-500 group-hover:scale-105" label={listing.name} />
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h2 className="font-serif text-lg text-cream">{listing.name}</h2>
        <p className="mb-3 text-xs text-muted">
          by {listing.creatorName} · {listing.bottleLabel}
        </p>
        <NoteProfileList profile={listing.profile} />
        <p className="mt-auto pt-4 text-sm text-gold">{formatNaira(listing.buyerPriceKobo)}</p>
      </div>
    </Link>
  );
}
