"use client";

import { useDroppable } from "@dnd-kit/core";
import { useEffect, useRef } from "react";
import { POUR_STEP_PCT } from "@/lib/domain";
import { cn } from "@/lib/cn";
import type { CatalogIngredient } from "@/server/dal/catalog";

export const BOTTLE_DROP_ID = "bottle";

const HOLD_DELAY_MS = 350;
const HOLD_REPEAT_MS = 180;

/**
 * The bottle as a pour target: tap to pour one measure from the picked vial, hold to keep
 * pouring. Vials can also be dropped onto it.
 */
export function PourTarget({
  pickedName,
  canPour,
  onPour,
  children,
}: {
  pickedName: string | null;
  canPour: boolean;
  onPour: () => void;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: BOTTLE_DROP_ID });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const pour = useRef(onPour);
  useEffect(() => {
    pour.current = onPour;
  }, [onPour]);

  function stop() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }

  function start() {
    held.current = false;
    if (!canPour) return;
    const repeat = () => {
      held.current = true;
      pour.current();
      timer.current = setTimeout(repeat, HOLD_REPEAT_MS);
    };
    timer.current = setTimeout(repeat, HOLD_DELAY_MS);
  }

  useEffect(() => stop, []);

  return (
    <button
      ref={setNodeRef}
      type="button"
      aria-disabled={!canPour || undefined}
      aria-label={
        pickedName ? `Pour ${pickedName} into the bottle (${POUR_STEP_PCT}%)` : "Your blend. Pick an ingredient, then tap here to pour"
      }
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        // A hold already poured; the click that ends it shouldn't pour again.
        if (!held.current && canPour) onPour();
        held.current = false;
      }}
      className={cn(
        "block w-full touch-manipulation select-none rounded-3xl transition-shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold",
        canPour ? "cursor-pointer" : "cursor-default",
        (isOver || (pickedName && canPour)) && "shadow-[0_0_60px_rgba(201,168,76,0.25)]",
      )}
    >
      {children}
    </button>
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
