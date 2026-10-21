"use client";

import { BottleVisual, type BottleLayers } from "@/components/scent/bottle-visual";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { NOTE_TIERS, type NoteTier } from "@/lib/domain";
import { TIER_LABELS } from "@/lib/labels";
import type { MixerState } from "@/lib/mixer/state";
import { formatNaira } from "@/lib/money";
import { SCENT_NAME_MAX } from "@/lib/validation/scent";
import type { CatalogBottleOption, CatalogIngredient } from "@/server/dal/catalog";
import { BottleOptionPicker } from "./bottle-option-picker";

export function MixerPreview({
  state,
  byId,
  layers,
  shares,
  bottleOptions,
  priceKobo,
  nameError,
  busy,
  onNameChange,
  onBottleChange,
  onBack,
  onAddToCart,
  onSave,
  onList,
}: {
  state: MixerState;
  byId: Map<string, CatalogIngredient>;
  layers: BottleLayers;
  shares: Record<NoteTier, number>;
  bottleOptions: CatalogBottleOption[];
  priceKobo: number | null;
  nameError: string | null;
  busy: null | "draft" | "save" | "list";
  onNameChange: (name: string) => void;
  onBottleChange: (id: string) => void;
  onBack: () => void;
  onAddToCart: () => void;
  onSave: () => void;
  onList: () => void;
}) {
  return (
    <div className="mt-6 grid gap-10 xl:grid-cols-[220px_1fr]">
      <div className="hidden xl:block">
        <BottleVisual layers={layers} shares={shares} className="mx-auto h-80" label={state.name || "Your blend"} />
      </div>

      <div className="space-y-8">
        <Field label="Give your scent a name" error={nameError}>
          {({ id, describedBy }) => (
            <Input
              id={id}
              value={state.name}
              maxLength={SCENT_NAME_MAX}
              placeholder="e.g. Midnight Bloom"
              aria-invalid={Boolean(nameError)}
              aria-describedby={describedBy}
              onChange={(e) => onNameChange(e.target.value)}
              className="font-serif text-lg"
            />
          )}
        </Field>

        <div className="border border-line">
          <p className="border-b border-line px-4 py-3 font-serif text-[0.7rem] uppercase tracking-label text-gold">
            Your notes
          </p>
          <dl className="divide-y divide-line-soft">
            {NOTE_TIERS.map((tier) => (
              <div key={tier} className="flex gap-4 px-4 py-3">
                <dt className="w-16 shrink-0 font-serif text-xs uppercase tracking-label text-muted">{TIER_LABELS[tier]}</dt>
                <dd className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-champagne">
                  {state.selections[tier].map((id) => {
                    const ingredient = byId.get(id);
                    return ingredient ? (
                      <span key={id} className="flex items-center gap-1.5">
                        <span className="size-2.5 rounded-full" style={{ backgroundColor: ingredient.colorHex }} aria-hidden />
                        {ingredient.name}
                      </span>
                    ) : null;
                  })}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <BottleOptionPicker options={bottleOptions} value={state.bottleOptionId} onChange={onBottleChange} />

        <div className="flex items-baseline justify-between border-t border-line pt-5">
          <span className="font-serif text-xs uppercase tracking-label text-muted">Price</span>
          <span className="font-serif text-2xl text-gold" aria-live="polite">
            {priceKobo === null ? "—" : formatNaira(priceKobo)}
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Button size="lg" onClick={onAddToCart} disabled={priceKobo === null} className="whitespace-nowrap px-4">
            Add to cart
          </Button>
          <Button
            variant="ghost"
            size="lg"
            className="whitespace-nowrap px-4"
            onClick={onSave}
            pending={busy === "save"}
            disabled={busy !== null && busy !== "save"}
          >
            Save to library
          </Button>
          <Button
            variant="ghost"
            size="lg"
            className="whitespace-nowrap px-4"
            onClick={onList}
            pending={busy === "list"}
            disabled={busy !== null && busy !== "list"}
          >
            List for sale
          </Button>
        </div>
        <Button variant="link" onClick={onBack}>
          ← Back to top notes
        </Button>
      </div>
    </div>
  );
}
