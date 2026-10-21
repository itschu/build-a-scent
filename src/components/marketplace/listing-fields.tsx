"use client";

import { Field, Input, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { LISTING_DESCRIPTION_MAX, MAX_FEATURED_NOTES, NOTE_TIERS, type NoteTier } from "@/lib/domain";
import { TIER_LABELS } from "@/lib/labels";
import { formatNaira, parseNairaToKobo } from "@/lib/money";
import { marketplaceSplit } from "@/lib/pricing";

export type ListingFieldValues = { description: string; markup: string; featured: string[] };

/** Description, creator markup with live earnings breakdown, and featured-note picker. */
export function ListingFields({
  values,
  onChange,
  ingredients,
  blendPriceKobo,
  commissionPct,
  minMarkupKobo,
}: {
  values: ListingFieldValues;
  onChange: (values: ListingFieldValues) => void;
  ingredients: Array<{ id: string; name: string; tier: NoteTier }>;
  blendPriceKobo: number | null;
  commissionPct: number;
  minMarkupKobo: number;
}) {
  const markupKobo = parseNairaToKobo(values.markup);
  const split =
    blendPriceKobo !== null && markupKobo && markupKobo > 0
      ? marketplaceSplit({ blendPriceKobo, creatorMarkupKobo: markupKobo, commissionPct })
      : null;
  const belowMin = markupKobo !== null && markupKobo < minMarkupKobo;

  function toggleFeatured(id: string) {
    const featured = values.featured.includes(id)
      ? values.featured.filter((f) => f !== id)
      : values.featured.length < MAX_FEATURED_NOTES
        ? [...values.featured, id]
        : values.featured;
    onChange({ ...values, featured });
  }

  return (
    <div className="space-y-6">
      <Field label="Description (optional)" hint={`${values.description.length}/${LISTING_DESCRIPTION_MAX} characters`}>
        {({ id, describedBy }) => (
          <Textarea
            id={id}
            value={values.description}
            maxLength={LISTING_DESCRIPTION_MAX}
            aria-describedby={describedBy}
            placeholder="What makes this scent special?"
            onChange={(e) => onChange({ ...values, description: e.target.value })}
          />
        )}
      </Field>

      <Field
        label="Your markup (₦)"
        hint={`Added on top of the blend price. Minimum ${formatNaira(minMarkupKobo)}.`}
        error={belowMin ? `The minimum markup is ${formatNaira(minMarkupKobo)}.` : null}
      >
        {({ id, describedBy }) => (
          <Input
            id={id}
            value={values.markup}
            inputMode="decimal"
            placeholder="5,000"
            aria-invalid={belowMin}
            aria-describedby={describedBy}
            onChange={(e) => onChange({ ...values, markup: e.target.value })}
          />
        )}
      </Field>

      <dl className="space-y-2 border border-line bg-coal p-5 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted">Blend price (what we charge to make it)</dt>
          <dd>{blendPriceKobo === null ? "—" : formatNaira(blendPriceKobo)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">Your markup</dt>
          <dd>{markupKobo ? formatNaira(markupKobo) : "—"}</dd>
        </div>
        <div className="flex justify-between border-t border-line pt-2 font-serif">
          <dt className="text-champagne">Buyer pays</dt>
          <dd className="text-gold">{split ? formatNaira(split.buyerPriceKobo) : "—"}</dd>
        </div>
        <p className="pt-2 text-xs text-champagne">
          {split
            ? `At the current platform rate (${commissionPct}%), you would earn ${formatNaira(split.sellerEarningKobo)} per sale.`
            : "Enter a markup to see your earnings."}
        </p>
        <p className="text-xs text-faint">
          Commission is applied when a sale happens. If ingredient prices change, the buyer price changes but your markup doesn&apos;t.
        </p>
      </dl>

      <fieldset>
        <legend className="mb-1 font-serif text-[0.7rem] uppercase tracking-label text-muted">
          Featured notes ({values.featured.length}/{MAX_FEATURED_NOTES})
        </legend>
        <p className="mb-3 text-xs text-faint">
          Buyers see the scent family of each tier plus the notes you feature here. Your full formula stays private.
        </p>
        <div className="space-y-2">
          {NOTE_TIERS.map((tier) => (
            <div key={tier} className="flex flex-wrap items-center gap-2">
              <span className="w-14 font-serif text-xs uppercase tracking-label text-gold">{TIER_LABELS[tier]}</span>
              {ingredients
                .filter((i) => i.tier === tier)
                .map((i) => {
                  const checked = values.featured.includes(i.id);
                  const disabled = !checked && values.featured.length >= MAX_FEATURED_NOTES;
                  return (
                    <label
                      key={i.id}
                      className={cn(
                        "cursor-pointer border px-3 py-1.5 text-xs",
                        checked ? "border-gold text-gold" : "border-line text-muted",
                        disabled && "cursor-not-allowed opacity-40",
                      )}
                    >
                      <input type="checkbox" className="sr-only" checked={checked} disabled={disabled} onChange={() => toggleFeatured(i.id)} />
                      {i.name}
                    </label>
                  );
                })}
            </div>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
