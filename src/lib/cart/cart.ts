// Client-side cart (Tech Plan, Decision 3). Items carry identifiers plus a last-seen display
// price; the server recalculates everything at checkout.
import { canonicalFormula, type Formula } from "@/lib/formula";

export const MAX_LINE_QUANTITY = 10;

type LineBase = {
  key: string;
  name: string;
  quantity: number;
  /** Price per unit when added; shown in the cart, never trusted by the server. */
  displayPriceKobo: number;
};

export type CustomScentLine = LineBase & {
  type: "custom_scent";
  formula: Formula;
  bottleOptionId: string;
  /** e.g. "50ml · Spray" */
  bottleLabel: string;
  /** Layer colours for the bottle visual, base → top. */
  colors: string[];
};

export type MarketplaceLine = LineBase & {
  type: "marketplace_listing";
  listingId: string;
  bottleLabel: string;
  creatorName: string;
  colors: string[];
};

export type StandardProductLine = LineBase & {
  type: "standard_product";
  productId: string;
  variantId: string;
  variantLabel: string;
  imageUrl: string | null;
};

export type CartLine = CustomScentLine | MarketplaceLine | StandardProductLine;
export type NewCartLine =
  | Omit<CustomScentLine, "key" | "quantity">
  | Omit<MarketplaceLine, "key" | "quantity">
  | Omit<StandardProductLine, "key" | "quantity">;

/** Identical items share a line (and add up quantity); a differently named blend is its own line. */
export function lineKey(line: NewCartLine): string {
  switch (line.type) {
    case "custom_scent":
      return `custom:${line.bottleOptionId}:${canonicalFormula(line.formula)}:${line.name.trim().toLowerCase()}`;
    case "marketplace_listing":
      return `listing:${line.listingId}`;
    case "standard_product":
      return `variant:${line.variantId}`;
  }
}

function clampQuantity(quantity: number): number {
  return Math.max(1, Math.min(MAX_LINE_QUANTITY, Math.floor(quantity)));
}

export function addLine(lines: CartLine[], item: NewCartLine, quantity = 1): CartLine[] {
  const key = lineKey(item);
  const existing = lines.find((l) => l.key === key);
  if (existing) {
    return lines.map((l) =>
      l.key === key ? { ...l, ...item, key, quantity: clampQuantity(l.quantity + quantity) } : l,
    ) as CartLine[];
  }
  return [...lines, { ...item, key, quantity: clampQuantity(quantity) } as CartLine];
}

export function updateLineQuantity(lines: CartLine[], key: string, quantity: number): CartLine[] {
  if (quantity <= 0) return removeLine(lines, key);
  return lines.map((l) => (l.key === key ? { ...l, quantity: clampQuantity(quantity) } : l));
}

export function removeLine(lines: CartLine[], key: string): CartLine[] {
  return lines.filter((l) => l.key !== key);
}

export function itemCount(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0);
}

export function subtotalKobo(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.displayPriceKobo * l.quantity, 0);
}
