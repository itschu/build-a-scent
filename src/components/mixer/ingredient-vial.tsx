"use client";

import { useDraggable } from "@dnd-kit/core";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";
import type { CatalogIngredient } from "@/server/dal/catalog";

/**
 * An ingredient as a vial of coloured liquid. Tap to pick it up, then tap the bottle to pour;
 * with a mouse it can also be dragged onto the bottle.
 */
export function IngredientVial({
  ingredient,
  amount,
  picked,
  blocked,
  onPick,
}: {
  ingredient: CatalogIngredient;
  /** Percent of the blend already poured (0 if not in the bottle). */
  amount: number;
  picked: boolean;
  /** Why nothing more can be poured from this vial, if anything. */
  blocked: string | null;
  onPick: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `ingredient:${ingredient.id}`,
    data: { ingredientId: ingredient.id },
    disabled: Boolean(blocked),
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...listeners}
      {...attributes}
      // dnd-kit marks draggables as role=button; this is a real toggle button instead.
      role={undefined}
      aria-pressed={picked}
      aria-disabled={(blocked && !picked) || undefined}
      aria-label={`${ingredient.name}, ${ingredient.scentFamily}${amount > 0 ? `, ${amount}% of your blend` : ""}${
        picked ? ", picked up" : ""
      }`}
      onClick={onPick}
      className={cn(
        "group relative flex select-none flex-col items-center px-2 pb-3 pt-4 text-center transition-colors",
        picked ? "bg-raised" : "hover:bg-raised/60",
        blocked && !picked ? "cursor-not-allowed opacity-40" : "cursor-pointer",
        isDragging && "opacity-30",
      )}
    >
      <motion.span
        className="mb-3 block"
        animate={picked && !reduceMotion ? { y: -10, rotate: -14 } : { y: 0, rotate: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 18 }}
        aria-hidden
      >
        <VialGlyph color={ingredient.colorHex} picked={picked} />
      </motion.span>
      <span className="font-serif text-[0.72rem] uppercase tracking-[0.12em] text-champagne">{ingredient.name}</span>
      <span className="mt-0.5 text-[0.68rem] text-faint">{ingredient.scentFamily}</span>
      {amount > 0 && (
        <span className="absolute right-1.5 top-1.5 bg-gold px-1.5 text-[0.65rem] leading-4 text-ink" aria-hidden>
          {amount}%
        </span>
      )}
    </button>
  );
}

function VialGlyph({ color, picked, className }: { color: string; picked?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 28 72" className={cn("h-16 w-7", className)}>
      <rect x="4" y="2" width="20" height="5" rx="2" fill={picked ? "#c9a84c" : "#5a4a2a"} />
      <path d="M6 7h16v51a8 8 0 0 1-16 0Z" fill="#0d0d0d" stroke={picked ? "#c9a84c" : "#3a3a3a"} strokeWidth="1.5" />
      <path d="M7 24h14v34a7 7 0 0 1-14 0Z" fill={color} opacity="0.92" />
      <rect x="9" y="12" width="2.5" height="40" rx="1.25" fill="#fff" opacity="0.08" />
    </svg>
  );
}

/** The vial shown under the pointer while dragging. */
export function IngredientDragPreview({ ingredient }: { ingredient: CatalogIngredient }) {
  return (
    <div className="flex -rotate-12 flex-col items-center drop-shadow-2xl">
      <VialGlyph color={ingredient.colorHex} picked />
    </div>
  );
}
