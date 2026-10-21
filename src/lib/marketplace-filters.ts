import { PRICE_BANDS } from "./shop-filters";

export type MarketplaceFilters = { family: string | null; price: (typeof PRICE_BANDS)[number]["key"] | null; note: string | null };

export function parseMarketplaceFilters(params: Record<string, string | string[] | undefined>): MarketplaceFilters {
  const one = (k: string) => (typeof params[k] === "string" && params[k] ? (params[k] as string) : null);
  const price = one("price");
  return {
    family: one("family"),
    price: PRICE_BANDS.some((b) => b.key === price) ? (price as MarketplaceFilters["price"]) : null,
    note: one("note"),
  };
}

export function matchesMarketplaceFilters(
  item: { families: string[]; featuredNotes: string[]; buyerPriceKobo: number },
  filters: MarketplaceFilters,
): boolean {
  if (filters.family && !item.families.includes(filters.family)) return false;
  if (filters.note && !item.featuredNotes.includes(filters.note)) return false;
  if (filters.price) {
    const band = PRICE_BANDS.find((b) => b.key === filters.price)!;
    if (item.buyerPriceKobo < band.min || item.buyerPriceKobo >= band.max) return false;
  }
  return true;
}
