"use client";

import Link from "next/link";
import { useState } from "react";
import { submitListingAction } from "@/app/(user)/account/seller/actions";
import { VerifyEmailBanner } from "@/app/(user)/account/account-security";
import { BottleVisual } from "@/components/scent/bottle-visual";
import { Button, buttonClasses } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { useSession } from "@/lib/auth-client";
import { parseNairaToKobo } from "@/lib/money";
import type { ListingDraft } from "@/server/dal/marketplace";
import { ListingFields, type ListingFieldValues } from "./listing-fields";

export function ListingForm({ draft }: { draft: ListingDraft }) {
  const { data: session } = useSession();
  const [values, setValues] = useState<ListingFieldValues>({ description: "", markup: "", featured: [] });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState<null | "pending_review" | "approved">(null);
  const layers = {
    base: draft.ingredients.filter((i) => i.tier === "base").map((i) => i.colorHex),
    heart: draft.ingredients.filter((i) => i.tier === "heart").map((i) => i.colorHex),
    top: draft.ingredients.filter((i) => i.tier === "top").map((i) => i.colorHex),
  };

  if (submitted) {
    return (
      <div className="py-10 text-center">
        <BottleVisual layers={layers} className="mx-auto mb-6 h-48" />
        {submitted === "approved" ? (
          <>
            <h2 className="mb-3 font-serif text-2xl text-cream">Your scent is live on the marketplace.</h2>
            <p className="mb-8 text-sm text-muted">Buyers can find it now. You&apos;ll be notified when it sells.</p>
          </>
        ) : (
          <>
            <h2 className="mb-3 font-serif text-2xl text-cream">Your scent has been submitted for review.</h2>
            <p className="mb-8 text-sm text-muted">We&apos;ll notify you once it&apos;s approved.</p>
          </>
        )}
        <Link href="/account/seller" className={buttonClasses()}>
          Go to seller dashboard
        </Link>
      </div>
    );
  }

  async function submit() {
    const markup = parseNairaToKobo(values.markup);
    if (markup === null || markup < draft.minMarkupKobo) return setError("Enter a markup at or above the minimum.");
    setPending(true);
    setError(null);
    const result = await submitListingAction({
      scentId: draft.scentId,
      description: values.description,
      creatorMarkupKobo: markup,
      featuredIngredientIds: values.featured,
    });
    setPending(false);
    if (!result.ok) return setError(result.error);
    setSubmitted(result.data.status);
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-6 border border-line bg-surface p-5">
        <BottleVisual layers={layers} className="h-28 w-16 shrink-0" />
        <div>
          <p className="font-serif text-xl text-cream">{draft.name}</p>
          <p className="text-xs text-muted">{draft.bottleLabel} · size and format are fixed for this listing</p>
        </div>
      </div>
      {!draft.emailVerified && session && <VerifyEmailBanner email={session.user.email} />}
      <ListingFields
        values={values}
        onChange={setValues}
        ingredients={draft.ingredients}
        blendPriceKobo={draft.blendPriceKobo}
        commissionPct={draft.commissionPct}
        minMarkupKobo={draft.minMarkupKobo}
      />
      {error && <Notice tone="error">{error}</Notice>}
      <Button size="lg" pending={pending} onClick={submit} disabled={!draft.emailVerified}>
        Submit for review
      </Button>
      {!draft.emailVerified && <p className="text-xs text-faint">Verify your email to submit. Refresh this page after verifying.</p>}
    </div>
  );
}
