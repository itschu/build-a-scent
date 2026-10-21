import type { BottleFormat, NoteTier } from "./domain";

export const FORMAT_LABELS: Record<BottleFormat, string> = {
  spray: "Spray",
  roll_on: "Roll-on",
  oil: "Oil",
};

export const TIER_LABELS: Record<NoteTier, string> = {
  base: "Base",
  heart: "Heart",
  top: "Top",
};

export function bottleLabel(option: { sizeLabel: string; format: BottleFormat }): string {
  return `${option.sizeLabel} · ${FORMAT_LABELS[option.format]}`;
}
