"use client";

import { Price } from "@/components/cart/price";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { useCartStore } from "@/lib/cart/store";
import { mixColors } from "@/lib/color";
import { NOTE_TIERS, type NoteTier } from "@/lib/domain";

export function AddListingToCart({
  listing,
}: {
  listing: { id: string; name: string; creatorName: string; bottleLabel: string; buyerPriceKobo: number; layers: Record<NoteTier, string[]> };
}) {
  const addToCart = useCartStore((s) => s.addItem);
  return (
    <div className="flex flex-wrap items-center justify-between gap-6">
      <Price kobo={listing.buyerPriceKobo} className="font-serif text-3xl text-gold" />
      <Button
        size="lg"
        onClick={() => {
          addToCart({
            type: "marketplace_listing",
            listingId: listing.id,
            name: listing.name,
            creatorName: listing.creatorName,
            bottleLabel: listing.bottleLabel,
            colors: NOTE_TIERS.map((t) => mixColors(listing.layers[t]) ?? "#000000"),
            displayPriceKobo: listing.buyerPriceKobo,
          });
          toast(`${listing.name} added to your cart.`, { action: { label: "View cart", href: "/cart" } });
        }}
      >
        Add to cart
      </Button>
    </div>
  );
}
