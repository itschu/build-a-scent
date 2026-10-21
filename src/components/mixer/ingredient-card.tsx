"use client";

import { useDraggable } from "@dnd-kit/core";
import { cn } from "@/lib/cn";
import type { CatalogIngredient } from "@/server/dal/catalog";

export function IngredientCard({
  ingredient,
  selected,
  full,
  onToggle,
}: {
  ingredient: CatalogIngredient;
  selected: boolean;
  /** The tier already has 3 ingredients, so this one can't be added. */
  full: boolean;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `ingredient:${ingredient.id}`,
    data: { ingredientId: ingredient.id },
    disabled: selected || full,
  });
  const unavailable = full && !selected;

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...listeners}
      {...attributes}
      // dnd-kit marks draggables as role=button; this is a real toggle button instead.
      role={undefined}
      aria-pressed={selected}
      aria-disabled={unavailable || undefined}
      aria-label={`${ingredient.name}, ${ingredient.scentFamily}${selected ? ", in your blend" : ""}`}
      onClick={() => !unavailable && onToggle()}
      className={cn(
        "group relative flex touch-none select-none flex-col items-center border px-3 py-4 text-center transition-colors",
        selected ? "border-gold bg-raised" : "border-line hover:border-gold-dim",
        unavailable ? "cursor-not-allowed opacity-40" : selected ? "cursor-pointer" : "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-30",
      )}
    >
      <span
        className="mb-2.5 size-10 rounded-full shadow-[inset_0_-6px_12px_rgba(0,0,0,0.35)] ring-1 ring-white/10"
        style={{ backgroundColor: ingredient.colorHex }}
        aria-hidden
      />
      <span className="font-serif text-[0.75rem] uppercase tracking-[0.12em] text-champagne">{ingredient.name}</span>
      <span className="mt-1 text-[0.7rem] text-faint">{ingredient.scentFamily}</span>
      {selected && (
        <span className="absolute right-2 top-2 text-xs text-gold" aria-hidden>
          ✓
        </span>
      )}
    </button>
  );
}

/** The floating card shown under the pointer while dragging. */
export function IngredientDragPreview({ ingredient }: { ingredient: CatalogIngredient }) {
  return (
    <div className="flex w-28 flex-col items-center border border-gold bg-surface px-3 py-3 shadow-2xl">
      <span className="mb-2 size-9 rounded-full" style={{ backgroundColor: ingredient.colorHex }} aria-hidden />
      <span className="font-serif text-[0.7rem] uppercase tracking-[0.12em] text-champagne">{ingredient.name}</span>
    </div>
  );
}
