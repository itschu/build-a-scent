import { describe, expect, it } from "vitest";
import { matchesFilters, parseShopFilters } from "./shop-filters";

const item = { scentFamily: "Woody", minPriceKobo: 1_800_000, maxPriceKobo: 4_500_000, formats: ["spray" as const] };

describe("shop filters", () => {
  it("parses only known values", () => {
    expect(parseShopFilters({ family: "Woody", price: "bogus", format: "oil" })).toEqual({ family: "Woody", price: null, format: "oil" });
  });

  it("matches family, format and any overlapping price band", () => {
    expect(matchesFilters(item, { family: "Woody", price: "under-20k", format: "spray" })).toBe(true);
    expect(matchesFilters(item, { family: null, price: "over-40k", format: null })).toBe(true);
    expect(matchesFilters(item, { family: "Floral", price: null, format: null })).toBe(false);
    expect(matchesFilters(item, { family: null, price: null, format: "oil" })).toBe(false);
    expect(matchesFilters({ ...item, maxPriceKobo: 1_900_000 }, { family: null, price: "20k-40k", format: null })).toBe(false);
  });
});
