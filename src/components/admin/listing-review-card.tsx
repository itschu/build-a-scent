"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { approveListingAction, rejectListingAction } from "@/app/(admin)/admin/listings/actions";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/dates";
import { NOTE_TIERS } from "@/lib/domain";
import { TIER_LABELS } from "@/lib/labels";
import { formatNaira } from "@/lib/money";
import type { PendingListing } from "@/server/dal/moderation";

export function ListingReviewCard({ listing }: { listing: PendingListing }) {
  const router = useRouter();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<null | "approve" | "reject">(null);

  async function approve() {
    setPending("approve");
    const result = await approveListingAction(listing.id);
    setPending(null);
    if (!result.ok) return toast(result.error, { tone: "error" });
    toast(`${listing.name} approved and live.`);
    router.refresh();
  }

  async function reject() {
    if (!reason.trim()) return setError("Enter a reason for the seller.");
    setPending("reject");
    const result = await rejectListingAction(listing.id, reason);
    setPending(null);
    if (!result.ok) return setError(result.error);
    toast(`${listing.name} rejected. The seller has been notified.`, { tone: "info" });
    router.refresh();
  }

  return (
    <article className="border border-line bg-surface p-5">
      <div className="grid gap-5 md:grid-cols-[1fr_auto]">
        <div className="min-w-0 space-y-3">
          <div>
            <h2 className="font-serif text-lg text-cream">{listing.name}</h2>
            <p className="text-xs text-muted">
              By {listing.seller.name} ({listing.seller.email}) · submitted {formatDate(listing.submittedAt)} · {listing.bottleLabel}
            </p>
          </div>
          {listing.duplicates.length > 0 && (
            <p className="border border-danger/40 px-3 py-2 text-xs text-danger">
              Possible duplicate: same formula as{" "}
              {listing.duplicates.map((d) => `"${d.name}" by ${d.sellerName} (${d.status.replace("_", " ")})`).join(", ")}.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {NOTE_TIERS.map((tier) => {
              const items = listing.formula.filter((i) => i.tier === tier);
              return (
                <span key={tier} className="border border-line px-2.5 py-1 text-[0.7rem] text-muted">
                  <span className="font-serif uppercase tracking-label text-gold">{TIER_LABELS[tier]}:</span>{" "}
                  {items.map((i, idx) => (
                    <span key={i.id} className={cn(i.featured && "text-champagne underline decoration-gold", !i.isActive && "text-danger line-through")}>
                      {idx > 0 && ", "}
                      {i.name}
                    </span>
                  ))}
                </span>
              );
            })}
          </div>
          <p className="text-[0.7rem] text-faint">Underlined notes are featured to buyers.</p>
          {listing.description && <p className="text-sm text-champagne">&ldquo;{listing.description}&rdquo;</p>}
          {listing.split ? (
            <p className="text-sm text-muted">
              Blend {formatNaira(listing.split.blendPriceKobo)} + markup {formatNaira(listing.split.creatorMarkupKobo)} = buyer pays{" "}
              <span className="text-gold">{formatNaira(listing.split.buyerPriceKobo)}</span> · current estimate at {listing.split.commissionPct}%:
              seller may earn {formatNaira(listing.split.sellerEarningKobo)}
            </p>
          ) : (
            <p className="text-sm text-danger">This formula uses a discontinued ingredient or bottle, so it can&apos;t be sold.</p>
          )}
        </div>
        {!rejecting && (
          <div className="flex gap-2 md:flex-col">
            <Button
              size="sm"
              className="bg-success/20 text-success hover:bg-success/30"
              pending={pending === "approve"}
              disabled={pending !== null || !listing.split}
              onClick={approve}
            >
              Approve
            </Button>
            <Button size="sm" variant="danger" disabled={pending !== null} onClick={() => setRejecting(true)}>
              Reject
            </Button>
          </div>
        )}
      </div>
      {rejecting && (
        <div className="mt-5 space-y-3 border-t border-line pt-5">
          <Field label="Reason for the seller" error={error} hint="The seller sees this in their dashboard and email.">
            {({ id, describedBy }) => (
              <Textarea
                id={id}
                value={reason}
                maxLength={500}
                aria-describedby={describedBy}
                onChange={(e) => {
                  setReason(e.target.value);
                  setError(null);
                }}
                placeholder="e.g. The description makes medical claims. Please remove them and resubmit."
              />
            )}
          </Field>
          <div className="flex gap-3">
            <Button variant="danger" size="sm" pending={pending === "reject"} onClick={reject}>
              Reject listing
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setRejecting(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}
