"use client";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { useCartStore } from "@/lib/cart/store";
import { mixColors } from "@/lib/color";
import { NOTE_TIERS, type NoteTier } from "@/lib/domain";
import type { Formula } from "@/lib/formula";

export function OrderSharedBlendButton({
  name,
  formula,
  layers,
  bottle,
  priceKobo,
}: {
  name: string;
  formula: Formula;
  layers: Record<NoteTier, string[]>;
  bottle: { id: string; label: string };
  priceKobo: number;
}) {
  const addToCart = useCartStore((s) => s.addItem);
  return (
    <Button
      size="lg"
      onClick={() => {
        addToCart({
          type: "custom_scent",
          name,
          formula,
          bottleOptionId: bottle.id,
          bottleLabel: bottle.label,
          colors: NOTE_TIERS.map((t) => mixColors(layers[t]) ?? "#000000"),
          displayPriceKobo: priceKobo,
        });
        toast(`${name} added to your cart.`, { action: { label: "View cart", href: "/cart" } });
      }}
    >
      Order this blend
    </Button>
  );
}
