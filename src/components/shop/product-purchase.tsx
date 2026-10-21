"use client";

import { useState } from "react";
import { Price } from "@/components/cart/price";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { useCartStore } from "@/lib/cart/store";
import { cn } from "@/lib/cn";
import { FORMAT_LABELS } from "@/lib/labels";
import type { ShopProduct } from "@/server/dal/products";

const LOW_STOCK = 5;

export function ProductPurchase({ product }: { product: ShopProduct }) {
  const addToCart = useCartStore((s) => s.addItem);
  const lines = useCartStore((s) => s.lines);
  const firstInStock = product.variants.find((v) => v.available > 0) ?? product.variants[0];
  const [variantId, setVariantId] = useState(firstInStock.id);
  const variant = product.variants.find((v) => v.id === variantId)!;
  const inCart = lines.find((l) => l.type === "standard_product" && l.variantId === variant.id)?.quantity ?? 0;
  const canAdd = variant.available > inCart;
  const label = `${variant.sizeLabel} · ${FORMAT_LABELS[variant.format]}`;

  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="mb-2 font-serif text-[0.7rem] uppercase tracking-label text-muted">Size & format</legend>
        <div className="flex flex-wrap gap-2">
          {product.variants.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={v.id === variantId}
              onClick={() => setVariantId(v.id)}
              className={cn(
                "border px-4 py-2.5 font-serif text-xs uppercase tracking-[0.12em]",
                v.id === variantId ? "border-gold text-gold" : "border-line text-champagne hover:border-gold-dim",
                v.available === 0 && "text-faint line-through",
              )}
            >
              {v.sizeLabel} · {FORMAT_LABELS[v.format]}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="flex items-baseline justify-between border-t border-line pt-5">
        <Price kobo={variant.priceKobo} className="font-serif text-3xl text-gold" />
        <span className={cn("text-xs", variant.available === 0 ? "text-danger" : variant.available <= LOW_STOCK ? "text-gold" : "text-muted")}>
          {variant.available === 0 ? "Out of stock" : variant.available <= LOW_STOCK ? `Only ${variant.available} left` : "In stock"}
        </span>
      </div>
      <Button
        size="lg"
        className="w-full"
        disabled={!canAdd}
        onClick={() => {
          addToCart({
            type: "standard_product",
            name: product.name,
            productId: product.id,
            variantId: variant.id,
            variantLabel: label,
            imageUrl: product.images[0] ?? null,
            displayPriceKobo: variant.priceKobo,
          });
          toast(`${product.name} added to your cart.`, { action: { label: "View cart", href: "/cart" } });
        }}
      >
        {variant.available === 0 ? "Out of stock" : canAdd ? "Add to cart" : "All available stock is in your cart"}
      </Button>
    </div>
  );
}
