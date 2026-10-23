import { NOTE_TIERS } from "@/lib/domain";
import { TIER_LABELS } from "@/lib/labels";
import type { ScentIngredient } from "@/server/dal/library";

/** Ingredient names (with amounts) grouped by tier; discontinued ones are struck through. */
export function ScentNotes({ ingredients }: { ingredients: ScentIngredient[] }) {
  return (
    <dl className="space-y-1.5 text-xs">
      {NOTE_TIERS.map((tier) => {
        const inTier = ingredients.filter((i) => i.tier === tier);
        return (
          <div key={tier} className="flex gap-3">
            <dt className="w-12 shrink-0 font-serif uppercase tracking-label text-gold">{TIER_LABELS[tier]}</dt>
            <dd className="text-muted">
              {inTier.length === 0
                ? "—"
                : inTier.map((i, idx) => (
                    <span key={i.id}>
                      {idx > 0 && ", "}
                      <span className={i.isActive ? undefined : "text-danger line-through"}>
                        {i.name}
                        {i.pct !== undefined && <span className="text-faint"> {i.pct}%</span>}
                      </span>
                    </span>
                  ))}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export function layersOf(ingredients: ScentIngredient[]) {
  return {
    base: ingredients.filter((i) => i.tier === "base").map((i) => i.colorHex),
    heart: ingredients.filter((i) => i.tier === "heart").map((i) => i.colorHex),
    top: ingredients.filter((i) => i.tier === "top").map((i) => i.colorHex),
  };
}
