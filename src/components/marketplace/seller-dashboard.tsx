"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { resubmitListingAction, withdrawListingAction } from "@/app/(user)/account/seller/actions";
import { BottleVisual } from "@/components/scent/bottle-visual";
import { Button, buttonClasses } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/dates";
import { LISTING_STATUS_LABELS } from "@/lib/listing-status";
import { formatNaira, parseNairaToKobo } from "@/lib/money";
import type { SellerEarnings, SellerListing } from "@/server/dal/marketplace";
import { ListingFields, type ListingFieldValues } from "./listing-fields";

const STATUS_TONE: Record<SellerListing["status"], string> = {
  pending_review: "border-line text-champagne",
  approved: "border-gold text-gold",
  rejected: "border-danger/50 text-danger",
  unavailable: "border-danger/50 text-danger",
  withdrawn: "border-line text-faint",
};

const ENTRY_LABELS: Record<string, string> = { sale_credit: "Sale", refund_debit: "Refund", payout_debit: "Payout" };

export function SellerDashboard({
  listings,
  earnings,
  commissionPct,
  minMarkupKobo,
}: {
  listings: SellerListing[];
  earnings: SellerEarnings;
  commissionPct: number;
  minMarkupKobo: number;
}) {
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_340px]">
      <section className="space-y-5">
        <h2 className="font-serif text-sm uppercase tracking-label text-gold">Your listings</h2>
        {listings.length === 0 ? (
          <div className="border border-dashed border-line px-6 py-14 text-center">
            <p className="mb-6 font-serif text-lg text-champagne">You haven&apos;t listed any scents yet.</p>
            <Link href="/library" className={buttonClasses()}>
              Choose a scent from your library
            </Link>
          </div>
        ) : (
          listings.map((l) => <ListingRow key={l.id} listing={l} commissionPct={commissionPct} minMarkupKobo={minMarkupKobo} />)
        )}
      </section>
      <EarningsPanel earnings={earnings} />
    </div>
  );
}

function ListingRow({ listing, commissionPct, minMarkupKobo }: { listing: SellerListing; commissionPct: number; minMarkupKobo: number }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<ListingFieldValues>({
    description: listing.description,
    markup: String(listing.creatorMarkupKobo / 100),
    featured: listing.featuredIngredientIds,
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canResubmit = listing.status === "rejected" || listing.status === "withdrawn";
  const canWithdraw = listing.status !== "withdrawn";

  async function withdraw() {
    if (!window.confirm(`Withdraw "${listing.name}"? It will leave the marketplace and the review queue.`)) return;
    setPending(true);
    const result = await withdrawListingAction(listing.id);
    setPending(false);
    if (!result.ok) return toast(result.error, { tone: "error" });
    toast("Listing withdrawn.", { tone: "info" });
    router.refresh();
  }

  async function resubmit() {
    const markup = parseNairaToKobo(values.markup);
    if (markup === null) return setError("Enter a valid markup.");
    setPending(true);
    setError(null);
    const result = await resubmitListingAction(listing.id, {
      description: values.description,
      creatorMarkupKobo: markup,
      featuredIngredientIds: values.featured,
    });
    setPending(false);
    if (!result.ok) return setError(result.error);
    toast("Submitted for review.");
    setEditing(false);
    router.refresh();
  }

  return (
    <article className="border border-line bg-surface">
      <div className="flex gap-5 p-5">
        <BottleVisual layers={listing.layers} className="h-28 w-16 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-serif text-lg text-cream">{listing.name}</h3>
              <p className="text-xs text-faint">
                {listing.bottleLabel} · submitted {formatDate(listing.submittedAt)}
              </p>
            </div>
            <span className={cn("border px-2 py-0.5 font-serif text-[0.65rem] uppercase tracking-label", STATUS_TONE[listing.status])}>
              {LISTING_STATUS_LABELS[listing.status]}
            </span>
          </div>
          {listing.split ? (
            <p className="mt-3 text-sm text-muted">
              Buyer pays <span className="text-champagne">{formatNaira(listing.split.buyerPriceKobo)}</span> · you earn{" "}
              <span className="text-gold">{formatNaira(listing.split.sellerEarningKobo)}</span> per sale at {commissionPct}%
            </p>
          ) : (
            <p className="mt-3 text-sm text-muted">Markup {formatNaira(listing.creatorMarkupKobo)}</p>
          )}
          {listing.status === "rejected" && listing.rejectionReason && (
            <Notice tone="error" className="mt-3">Reason: {listing.rejectionReason}</Notice>
          )}
          {listing.status === "unavailable" && (
            <Notice tone="error" className="mt-3">
              {listing.unavailableReason ?? "An ingredient or bottle is no longer available."} It will go live again automatically when
              it&apos;s back.
            </Notice>
          )}
        </div>
      </div>

      {editing && (
        <div className="space-y-4 border-t border-line p-5">
          <ListingFields
            values={values}
            onChange={setValues}
            ingredients={listing.ingredients}
            blendPriceKobo={listing.split?.blendPriceKobo ?? null}
            commissionPct={commissionPct}
            minMarkupKobo={minMarkupKobo}
          />
          {error && <Notice tone="error">{error}</Notice>}
          <div className="flex gap-3">
            <Button pending={pending} onClick={resubmit}>
              {listing.status === "withdrawn" ? "Relist for review" : "Resubmit for review"}
            </Button>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {!editing && (
        <div className="flex flex-wrap gap-2 border-t border-line p-4">
          {listing.status === "approved" && (
            <Link href={`/marketplace/${listing.id}`} className={buttonClasses({ variant: "ghost", size: "sm" })}>
              View live listing
            </Link>
          )}
          {canResubmit && (
            <Button size="sm" onClick={() => setEditing(true)}>
              {listing.status === "withdrawn" ? "Relist" : "Edit & resubmit"}
            </Button>
          )}
          {canWithdraw && (
            <Button variant="danger" size="sm" pending={pending} onClick={withdraw}>
              Withdraw
            </Button>
          )}
        </div>
      )}
    </article>
  );
}

function EarningsPanel({ earnings }: { earnings: SellerEarnings }) {
  return (
    <aside className="h-fit space-y-5 border border-line bg-coal p-6">
      <h2 className="font-serif text-sm uppercase tracking-label text-gold">Earnings</h2>
      <dl className="grid grid-cols-2 gap-4">
        <div>
          <dt className="text-xs text-muted">Pending</dt>
          <dd className="font-serif text-2xl text-champagne">{formatNaira(earnings.pendingKobo)}</dd>
          <p className="text-[0.7rem] text-faint">Paid orders not yet delivered</p>
        </div>
        <div>
          <dt className="text-xs text-muted">Available</dt>
          <dd className={cn("font-serif text-2xl", earnings.availableKobo < 0 ? "text-danger" : "text-gold")}>
            {formatNaira(earnings.availableKobo)}
          </dd>
          <p className="text-[0.7rem] text-faint">Delivered orders, less refunds</p>
        </div>
      </dl>
      <p className="border border-line px-3 py-2 text-xs text-muted">Payouts are coming soon. Your earnings are tracked safely until then.</p>
      {earnings.entries.length > 0 && (
        <div>
          <p className="mb-2 font-serif text-[0.65rem] uppercase tracking-label text-muted">History</p>
          <ul className="divide-y divide-line-soft text-xs">
            {earnings.entries.map((e) => (
              <li key={e.id} className="flex justify-between gap-3 py-2">
                <span className="text-muted">
                  {formatDate(e.createdAt)} · {ENTRY_LABELS[e.entryType] ?? e.entryType} · {e.listingName}
                  <span className="block text-faint">
                    {e.orderNumber} · {e.status}
                  </span>
                </span>
                <span className={e.amountKobo < 0 ? "text-danger" : e.status === "void" ? "text-faint line-through" : "text-champagne"}>
                  {formatNaira(e.amountKobo)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
