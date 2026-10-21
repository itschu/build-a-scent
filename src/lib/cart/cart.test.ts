import { describe, expect, it } from "vitest";
import type { Formula } from "@/lib/formula";
import { addLine, itemCount, MAX_LINE_QUANTITY, removeLine, subtotalKobo, updateLineQuantity, type NewCartLine } from "./cart";

const id = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, "0")}`;
const formula: Formula = [
  { ingredientId: id(1), tier: "base" },
  { ingredientId: id(2), tier: "heart" },
  { ingredientId: id(3), tier: "top" },
];

const blend: NewCartLine = {
  type: "custom_scent",
  name: "Midnight Bloom",
  formula,
  bottleOptionId: id(9),
  bottleLabel: "50ml · Spray",
  colors: ["#8b5a2b", "#c06080", "#c5d86d"],
  displayPriceKobo: 2_305_000,
};

const variant: NewCartLine = {
  type: "standard_product",
  name: "Noir Classic",
  productId: id(20),
  variantId: id(21),
  variantLabel: "50ml · Spray",
  imageUrl: null,
  displayPriceKobo: 1_800_000,
};

describe("cart", () => {
  it("merges identical blends regardless of ingredient order", () => {
    let lines = addLine([], blend);
    lines = addLine(lines, { ...blend, formula: [...formula].reverse() } as NewCartLine);
    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe(2);
  });

  it("keeps a differently named or sized blend on its own line", () => {
    let lines = addLine([], blend);
    lines = addLine(lines, { ...blend, name: "Dawn" } as NewCartLine);
    lines = addLine(lines, { ...blend, bottleOptionId: id(10) } as NewCartLine);
    expect(lines).toHaveLength(3);
  });

  it("caps quantity and removes a line set to zero", () => {
    let lines = addLine([], variant, 50);
    expect(lines[0].quantity).toBe(MAX_LINE_QUANTITY);
    lines = updateLineQuantity(lines, lines[0].key, 0);
    expect(lines).toEqual([]);
  });

  it("totals quantities and display prices", () => {
    let lines = addLine([], blend, 2);
    lines = addLine(lines, variant);
    expect(itemCount(lines)).toBe(3);
    expect(subtotalKobo(lines)).toBe(2 * 2_305_000 + 1_800_000);
    expect(removeLine(lines, lines[1].key)).toHaveLength(1);
  });
});
