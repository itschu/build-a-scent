/* eslint-disable @next/next/no-img-element -- remote product images; sizes are tiny */
import { BottleVisual } from "@/components/scent/bottle-visual";
import type { NoteTier } from "@/lib/domain";

/** Bottle visual for scents, product photo (or a plain bottle) for shop items. */
export function LineThumb({
  colors,
  imageUrl,
  className = "h-20 w-12",
}: {
  colors?: string[] | Record<NoteTier, string[]>;
  imageUrl?: string | null;
  className?: string;
}) {
  if (imageUrl) return <img src={imageUrl} alt="" className={`${className} object-cover`} />;
  const layers = Array.isArray(colors)
    ? { base: colors[0] ? [colors[0]] : [], heart: colors[1] ? [colors[1]] : [], top: colors[2] ? [colors[2]] : [] }
    : (colors ?? { base: ["#3b2414"], heart: ["#5a4a2a"], top: ["#c9a84c"] });
  return <BottleVisual layers={layers} className={className} />;
}
