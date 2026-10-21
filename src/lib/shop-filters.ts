import { BOTTLE_FORMATS, type BottleFormat } from "./domain";

export const PRICE_BANDS = [
  { key: "under-20k", label: "Under ₦20,000", min: 0, max: 2_000_000 },
  { key: "20k-40k", label: "₦20,000 – ₦40,000", min: 2_000_000, max: 4_000_000 },
  { key: "over-40k", label: "Over ₦40,000", min: 4_000_000, max: Number.POSITIVE_INFINITY },
] as const;

export type ShopFilters = { family: string | null; price: (typeof PRICE_BANDS)[number]["key"] | null; format: BottleFormat | null };

export function parseShopFilters(params: Record<string, string | string[] | undefined>): ShopFilters {
  const one = (k: string) => (typeof params[k] === "string" && params[k] ? (params[k] as string) : null);
  const price = one("price");
  const format = one("format");
  return {
    family: one("family"),
    price: PRICE_BANDS.some((b) => b.key === price) ? (price as ShopFilters["price"]) : null,
    format: BOTTLE_FORMATS.includes(format as BottleFormat) ? (format as BottleFormat) : null,
  };
}

/** A product matches a price band if any of its variants falls inside it. */
export function matchesFilters(
  item: { scentFamily: string; minPriceKobo: number; maxPriceKobo: number; formats: BottleFormat[] },
  filters: ShopFilters,
): boolean {
  if (filters.family && item.scentFamily !== filters.family) return false;
  if (filters.format && !item.formats.includes(filters.format)) return false;
  if (filters.price) {
    const band = PRICE_BANDS.find((b) => b.key === filters.price)!;
    if (item.maxPriceKobo < band.min || item.minPriceKobo >= band.max) return false;
  }
  return true;
}
