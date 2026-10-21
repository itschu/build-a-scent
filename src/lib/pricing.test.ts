import { describe, expect, it } from "vitest";
import type { Formula } from "./formula";
import {
  blendPriceKobo,
  ingredientCostKobo,
  marketplaceSplit,
  type PricingBottleOption,
  type PricingIngredient,
} from "./pricing";

const shares = { base: 40, heart: 35, top: 25 };
const naira = (n: number) => n * 100;

const ids = {
  sandalwood: "00000000-0000-4000-8000-000000000001",
  rose: "00000000-0000-4000-8000-000000000002",
  jasmine: "00000000-0000-4000-8000-000000000003",
  bergamot: "00000000-0000-4000-8000-000000000004",
  musk: "00000000-0000-4000-8000-000000000005",
  amber: "00000000-0000-4000-8000-000000000006",
};

const catalog = new Map<string, PricingIngredient>([
  [ids.sandalwood, { id: ids.sandalwood, pricePerMlKobo: naira(800) }],
  [ids.rose, { id: ids.rose, pricePerMlKobo: naira(1_200) }],
  [ids.jasmine, { id: ids.jasmine, pricePerMlKobo: naira(1_000) }],
  [ids.bergamot, { id: ids.bergamot, pricePerMlKobo: naira(400) }],
  [ids.musk, { id: ids.musk, pricePerMlKobo: naira(600) }],
  [ids.amber, { id: ids.amber, pricePerMlKobo: naira(700) }],
]);

const worked: Formula = [
  { ingredientId: ids.sandalwood, tier: "base" },
  { ingredientId: ids.rose, tier: "heart" },
  { ingredientId: ids.jasmine, tier: "heart" },
  { ingredientId: ids.bergamot, tier: "top" },
];

const spray50: PricingBottleOption = {
  volumeMl: 50,
  concentrationPct: 20,
  basePriceKobo: naira(15_000),
};

describe("blendPriceKobo", () => {
  it("matches the Tech Plan worked example (₦23,050)", () => {
    expect(ingredientCostKobo(worked, catalog, spray50, shares)).toBe(naira(8_050));
    expect(blendPriceKobo(worked, catalog, spray50, shares)).toBe(naira(23_050));
  });

  it("scales ingredient cost with volume and concentration for every format", () => {
    const cases: Array<[PricingBottleOption, number]> = [
      [{ volumeMl: 10, concentrationPct: 20, basePriceKobo: 0 }, 1_610], // 2ml concentrate
      [{ volumeMl: 100, concentrationPct: 20, basePriceKobo: 0 }, 16_100], // 20ml
      [{ volumeMl: 10, concentrationPct: 25, basePriceKobo: 0 }, 2_013], // 2.5ml roll-on, rounded up
      [{ volumeMl: 30, concentrationPct: 100, basePriceKobo: 0 }, 24_150], // 30ml oil
    ];
    for (const [bottle, expectedNaira] of cases) {
      expect(ingredientCostKobo(worked, catalog, bottle, shares)).toBe(naira(expectedNaira));
    }
  });

  it("splits a tier equally between three ingredients and rounds up once", () => {
    const formula: Formula = [
      { ingredientId: ids.sandalwood, tier: "base" },
      { ingredientId: ids.musk, tier: "base" },
      { ingredientId: ids.amber, tier: "base" },
      { ingredientId: ids.rose, tier: "heart" },
      { ingredientId: ids.bergamot, tier: "top" },
    ];
    // Base 4ml ÷ 3 = 1.333ml each: (800 + 600 + 700) × 4/3 = 2,800; heart 3.5 × 1,200 = 4,200;
    // top 2.5 × 400 = 1,000.
    expect(ingredientCostKobo(formula, catalog, spray50, shares)).toBe(naira(8_000));
  });

  it("rejects invalid tier shares and unknown ingredients", () => {
    expect(() => ingredientCostKobo(worked, catalog, spray50, { base: 40, heart: 40, top: 25 })).toThrow(
      /sum to 100/,
    );
    const unknown: Formula = [{ ingredientId: "00000000-0000-4000-8000-0000000000ff", tier: "top" }];
    expect(() => ingredientCostKobo(unknown, catalog, spray50, shares)).toThrow(/Unknown/);
  });
});

describe("marketplaceSplit", () => {
  it("applies commission to the markup only (Tech Plan example)", () => {
    expect(
      marketplaceSplit({ blendPriceKobo: naira(23_050), creatorMarkupKobo: naira(5_000), commissionPct: 20 }),
    ).toEqual({
      blendPriceKobo: naira(23_050),
      creatorMarkupKobo: naira(5_000),
      buyerPriceKobo: naira(28_050),
      commissionPct: 20,
      commissionKobo: naira(1_000),
      platformFeeKobo: naira(24_050),
      sellerEarningKobo: naira(4_000),
    });
  });

  it("always sums back to the buyer price, including fractional commissions", () => {
    const split = marketplaceSplit({ blendPriceKobo: 1_000_001, creatorMarkupKobo: 333_333, commissionPct: 12.5 });
    expect(split.platformFeeKobo + split.sellerEarningKobo).toBe(split.buyerPriceKobo);
    expect(split.commissionKobo).toBe(41_667);
  });

  it("rejects a non-positive markup or out-of-range commission", () => {
    expect(() => marketplaceSplit({ blendPriceKobo: 100, creatorMarkupKobo: 0, commissionPct: 20 })).toThrow();
    expect(() => marketplaceSplit({ blendPriceKobo: 100, creatorMarkupKobo: 100, commissionPct: 101 })).toThrow();
  });
});
