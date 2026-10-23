"use client";

import { useDroppable } from "@dnd-kit/core";
import { POUR_STEP_PCT } from "@/lib/domain";
import { cn } from "@/lib/cn";
import type { CatalogIngredient } from "@/server/dal/catalog";

export const BOTTLE_DROP_ID = "bottle";

/**
 * The bottle as a drop target for dragged vials. It glows while a vial is being dragged, and
 * more strongly when the vial is over it (holding it there keeps pouring).
 */
export function BottleDropTarget({ dragging, children }: { dragging: boolean; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: BOTTLE_DROP_ID });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-3xl transition-[box-shadow,transform] duration-200",
        dragging && "shadow-[0_0_40px_rgba(201,168,76,0.25)] ring-1 ring-gold/40",
        isOver && "scale-105 shadow-[0_0_70px_rgba(201,168,76,0.45)] ring-gold",
      )}
    >
      {children}
    </div>
  );
}

/** What's in the bottle, with fine-tuning: − pours a measure back, + pours another. */
export function PourList({
  items,
  pourBlocker,
  onPour,
  onPourBack,
  onRemove,
  className,
}: {
  items: Array<{ ingredient: CatalogIngredient; amount: number }>;
  pourBlocker: (ingredientId: string) => string | null;
  onPour: (ingredientId: string) => void;
  onPourBack: (ingredientId: string) => void;
  onRemove: (ingredientId: string) => void;
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <ul className={cn("space-y-1.5", className)}>
      {items.map(({ ingredient, amount }) => {
        const blocked = pourBlocker(ingredient.id);
        return (
          <li key={ingredient.id} className="flex items-center gap-2 border border-line bg-raised px-2.5 py-1.5 text-xs">
            <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: ingredient.colorHex }} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-champagne">{ingredient.name}</span>
            <button
              type="button"
              onClick={() => onPourBack(ingredient.id)}
              aria-label={`Pour back ${POUR_STEP_PCT}% of ${ingredient.name}`}
              className="size-6 border border-line text-muted hover:border-gold-dim hover:text-gold"
            >
              −
            </button>
            <span className="w-9 text-center tabular-nums text-gold" aria-live="polite">
              {amount}%
            </span>
            <button
              type="button"
              onClick={() => onPour(ingredient.id)}
              disabled={Boolean(blocked)}
              title={blocked ?? undefined}
              aria-label={`Pour ${POUR_STEP_PCT}% more ${ingredient.name}`}
              className="size-6 border border-line text-muted hover:border-gold-dim hover:text-gold disabled:cursor-not-allowed disabled:opacity-30"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => onRemove(ingredient.id)}
              aria-label={`Remove ${ingredient.name}`}
              className="ml-1 text-muted hover:text-danger"
            >
              ×
            </button>
          </li>
        );
      })}
    </ul>
  );
}
