"use client";

import { useDroppable } from "@dnd-kit/core";
import { MAX_INGREDIENTS_PER_TIER } from "@/lib/domain";
import { cn } from "@/lib/cn";
import type { CatalogIngredient } from "@/server/dal/catalog";

export const BOTTLE_DROP_ID = "bottle";

export function BottleDropZone({
  selected,
  onRemove,
}: {
  selected: CatalogIngredient[];
  onRemove: (ingredientId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: BOTTLE_DROP_ID });
  const full = selected.length >= MAX_INGREDIENTS_PER_TIER;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "border border-dashed px-4 py-4 transition-colors",
        isOver ? (full ? "border-danger/60 bg-danger/5" : "border-gold bg-gold/5") : "border-line",
      )}
    >
      <p className="mb-3 text-center font-serif text-[0.7rem] uppercase tracking-label text-muted" aria-live="polite">
        {full
          ? `Tier full · ${MAX_INGREDIENTS_PER_TIER} of ${MAX_INGREDIENTS_PER_TIER}`
          : `Drag ingredients here · ${selected.length} selected · max ${MAX_INGREDIENTS_PER_TIER}`}
      </p>
      {selected.length > 0 && (
        <ul className="flex flex-wrap justify-center gap-2">
          {selected.map((ingredient) => (
            <li key={ingredient.id}>
              <button
                type="button"
                onClick={() => onRemove(ingredient.id)}
                aria-label={`Remove ${ingredient.name}`}
                className="flex items-center gap-2 border border-gold-dim bg-raised px-3 py-1.5 text-xs text-champagne hover:border-danger/60"
              >
                <span className="size-3 rounded-full" style={{ backgroundColor: ingredient.colorHex }} aria-hidden />
                {ingredient.name}
                <span className="text-muted" aria-hidden>
                  ×
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Lets ingredients be dropped straight onto the bottle illustration as well. */
export function DroppableBottle({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${BOTTLE_DROP_ID}-visual` });
  return (
    <div ref={setNodeRef} className={cn("rounded-3xl transition-shadow", isOver && "shadow-[0_0_60px_rgba(201,168,76,0.25)]")}>
      {children}
    </div>
  );
}
