"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { setSharingAction } from "@/app/(user)/library/actions";
import { BottleVisual } from "@/components/scent/bottle-visual";
import { Button, buttonClasses } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { useOrigin } from "@/hooks/use-origin";
import { useCartStore } from "@/lib/cart/store";
import { cn } from "@/lib/cn";
import { mixColors } from "@/lib/color";
import { formatDate } from "@/lib/dates";
import { NOTE_TIERS } from "@/lib/domain";
import { LISTING_STATUS_LABELS } from "@/lib/listing-status";
import { formatNaira } from "@/lib/money";
import type { LibraryScent } from "@/server/dal/library";
import { layersOf, ScentNotes } from "./scent-notes";

export function SavedScentCard({ scent }: { scent: LibraryScent }) {
  const router = useRouter();
  const addToCart = useCartStore((s) => s.addItem);
  const [shareToken, setShareToken] = useState(scent.shareToken);
  const [sharePending, setSharePending] = useState(false);
  const layers = layersOf(scent.ingredients);
  const available = scent.availability.available;
  const name = scent.name ?? "Untitled scent";
  const origin = useOrigin();
  const shareUrl = shareToken && origin ? `${origin}/s/${shareToken}` : null;

  function reorder() {
    if (!available || !scent.bottle || scent.priceKobo === null) return;
    addToCart({
      type: "custom_scent",
      name,
      formula: scent.ingredients.map((i) => ({ ingredientId: i.id, tier: i.tier })),
      bottleOptionId: scent.bottle.id,
      bottleLabel: scent.bottle.label,
      colors: NOTE_TIERS.map((t) => mixColors(layers[t]) ?? "#000000"),
      displayPriceKobo: scent.priceKobo,
    });
    toast(`${name} added to your cart.`, { action: { label: "View cart", href: "/cart" } });
  }

  async function toggleShare() {
    setSharePending(true);
    const result = await setSharingAction(scent.id, !shareToken);
    setSharePending(false);
    if (!result.ok) return toast(result.error, { tone: "error" });
    setShareToken(result.data.shareToken);
    if (result.data.shareToken) {
      const url = `${window.location.origin}/s/${result.data.shareToken}`;
      try {
        await navigator.clipboard.writeText(url);
        toast("Share link copied to your clipboard.");
      } catch {
        toast("Sharing is on. Copy the link below.");
      }
    } else {
      toast("Sharing turned off. The old link no longer works.", { tone: "info" });
    }
    router.refresh();
  }

  return (
    <article className={cn("flex flex-col border border-line bg-surface", !available && "opacity-90")}>
      <div className="flex gap-4 p-5">
        <BottleVisual layers={layers} className="h-32 w-20 shrink-0" label={name} />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-start justify-between gap-2">
            <h2 className="truncate font-serif text-lg text-cream">{name}</h2>
            {scent.listing && (
              <Link
                href="/account/seller"
                className={cn(
                  "shrink-0 border px-2 py-0.5 text-[0.6rem] uppercase tracking-label",
                  scent.listing.status === "approved" ? "border-gold text-gold" : "border-line text-muted",
                )}
              >
                {LISTING_STATUS_LABELS[scent.listing.status]}
              </Link>
            )}
          </div>
          <p className="mb-3 text-xs text-faint">
            Saved {formatDate(scent.updatedAt)}
            {scent.bottle && ` · ${scent.bottle.label}`}
            {scent.priceKobo !== null && ` · ${formatNaira(scent.priceKobo)}`}
          </p>
          <ScentNotes ingredients={scent.ingredients} />
        </div>
      </div>

      {!scent.availability.available && (
        <p className="mx-5 mb-4 border border-danger/30 px-3 py-2 text-xs text-danger">
          View only. {scent.availability.reason}
        </p>
      )}

      {shareUrl && (
        <div className="mx-5 mb-4">
          <label className="sr-only" htmlFor={`share-${scent.id}`}>
            Share link
          </label>
          <input
            id={`share-${scent.id}`}
            readOnly
            value={shareUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full border border-line bg-ink px-2 py-1.5 text-xs text-muted"
          />
        </div>
      )}

      <div className="mt-auto flex flex-wrap gap-2 border-t border-line p-4">
        <Button size="sm" onClick={reorder} disabled={!available}>
          Reorder
        </Button>
        {available ? (
          <Link href={`/build?from=${scent.id}`} className={buttonClasses({ variant: "ghost", size: "sm" })}>
            Edit
          </Link>
        ) : (
          <Button variant="ghost" size="sm" disabled>
            Edit
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={toggleShare} pending={sharePending} disabled={!available && !shareToken}>
          {shareToken ? "Stop sharing" : "Share"}
        </Button>
        {!scent.listing &&
          (available ? (
            <Link href={`/marketplace/list?scent=${scent.id}`} className={buttonClasses({ variant: "ghost", size: "sm" })}>
              List for sale
            </Link>
          ) : (
            <Button variant="ghost" size="sm" disabled>
              List for sale
            </Button>
          ))}
      </div>
    </article>
  );
}
