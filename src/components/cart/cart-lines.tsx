"use client";

import { usePublicSettings } from "@/hooks/use-public-settings";
import { MAX_LINE_QUANTITY, type CartLine } from "@/lib/cart/cart";
import { useCartStore } from "@/lib/cart/store";
import { LineThumb } from "./line-thumb";
import { Price } from "./price";

function lineDetail(line: CartLine): string {
  switch (line.type) {
    case "custom_scent":
      return `Custom scent · ${line.bottleLabel}`;
    case "marketplace_listing":
      return `By ${line.creatorName} · ${line.bottleLabel}`;
    case "standard_product":
      return line.variantLabel;
  }
}

export function CartLines({ compact = false }: { compact?: boolean }) {
  const { lines, updateQty, removeItem } = useCartStore();
  // The store's per-item limit; checkout enforces it too.
  const maxQuantity = Math.min(MAX_LINE_QUANTITY, usePublicSettings()?.max_line_quantity ?? MAX_LINE_QUANTITY);

  return (
    <ul className="divide-y divide-line-soft">
      {lines.map((line) => (
        <li key={line.key} className="flex gap-4 py-4">
          <LineThumb
            colors={line.type === "standard_product" ? undefined : line.colors}
            imageUrl={line.type === "standard_product" ? line.imageUrl : null}
            className={compact ? "h-16 w-10 shrink-0" : "h-24 w-14 shrink-0"}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-serif text-cream">{line.name}</p>
                <p className="text-xs text-muted">{lineDetail(line)}</p>
              </div>
              <Price kobo={line.displayPriceKobo * line.quantity} className="shrink-0 text-sm text-gold" />
            </div>
            <div className="mt-3 flex items-center gap-4">
              <div className="flex items-center border border-line" role="group" aria-label={`Quantity of ${line.name}`}>
                <button
                  type="button"
                  className="px-3 py-1 text-muted hover:text-gold disabled:opacity-40"
                  onClick={() => updateQty(line.key, line.quantity - 1)}
                  disabled={line.quantity <= 1}
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <span className="w-8 text-center text-sm" aria-live="polite">
                  {line.quantity}
                </span>
                <button
                  type="button"
                  className="px-3 py-1 text-muted hover:text-gold disabled:opacity-40"
                  onClick={() => updateQty(line.key, line.quantity + 1)}
                  disabled={line.quantity >= maxQuantity}
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
              <button type="button" onClick={() => removeItem(line.key)} className="text-xs text-muted hover:text-danger">
                Remove
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
