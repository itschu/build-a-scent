// Pricing rules from the Tech Plan (Decisions 7 and 8). Pure functions shared by client and
// server; the server result is authoritative. All amounts are integer kobo.
import { countByTier, type Formula } from "./formula";
import { NOTE_TIERS, type NoteTier } from "./domain";

export type TierShares = Record<NoteTier, number>;

export type PricingIngredient = { id: string; pricePerMlKobo: number };

export type PricingBottleOption = {
  volumeMl: number;
  concentrationPct: number;
  basePriceKobo: number;
};

const KOBO_PER_NAIRA = 100n;

export function assertValidTierShares(shares: TierShares): void {
  const values = NOTE_TIERS.map((t) => shares[t]);
  if (values.some((v) => !Number.isInteger(v) || v < 0)) {
    throw new Error("Tier shares must be non-negative integers");
  }
  if (values.reduce((a, b) => a + b, 0) !== 100) {
    throw new Error("Tier shares must sum to 100");
  }
}

function ceilDiv(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator - 1n) / denominator;
}

/**
 * Cost of the ingredients in a bottle, rounded up to a whole naira.
 *
 * concentrate_ml = volume_ml × concentration_pct / 100. Each tier gets tier_share% of the
 * concentrate, split equally between its ingredients. The sum is computed exactly with
 * integers and rounded once at the end.
 */
export function ingredientCostKobo(
  formula: Formula,
  ingredients: ReadonlyMap<string, PricingIngredient>,
  bottle: PricingBottleOption,
  shares: TierShares,
): number {
  assertValidTierShares(shares);
  const counts = countByTier(formula);
  // Common denominator: 100 (concentration) × 100 (share) × 6 (lcm of 1, 2, 3 ingredients per tier).
  const lcm = 6n;
  const denominator = 100n * 100n * lcm;
  let numerator = 0n;
  for (const entry of formula) {
    const ingredient = ingredients.get(entry.ingredientId);
    if (!ingredient) throw new Error(`Unknown ingredient ${entry.ingredientId}`);
    const count = BigInt(counts[entry.tier]);
    if (lcm % count !== 0n) throw new Error("A tier can hold at most 3 ingredients");
    numerator +=
      BigInt(ingredient.pricePerMlKobo) *
      BigInt(bottle.volumeMl) *
      BigInt(bottle.concentrationPct) *
      BigInt(shares[entry.tier]) *
      (lcm / count);
  }
  const naira = ceilDiv(numerator, denominator * KOBO_PER_NAIRA);
  return Number(naira * KOBO_PER_NAIRA);
}

/** Price of a custom blend: bottle option base price + ingredient cost. */
export function blendPriceKobo(
  formula: Formula,
  ingredients: ReadonlyMap<string, PricingIngredient>,
  bottle: PricingBottleOption,
  shares: TierShares,
): number {
  return bottle.basePriceKobo + ingredientCostKobo(formula, ingredients, bottle, shares);
}

export type MarketplaceSplit = {
  blendPriceKobo: number;
  creatorMarkupKobo: number;
  buyerPriceKobo: number;
  commissionPct: number;
  /** Platform's commission on the markup only. */
  commissionKobo: number;
  /** Everything the platform keeps: the full blend price plus the commission. */
  platformFeeKobo: number;
  sellerEarningKobo: number;
};

/**
 * Marketplace price split. The buyer pays the live blend price plus the creator markup;
 * commission applies to the markup only (rounded half up to the kobo), so the platform
 * always keeps at least the blend price.
 */
export function marketplaceSplit(input: {
  blendPriceKobo: number;
  creatorMarkupKobo: number;
  commissionPct: number;
}): MarketplaceSplit {
  const { blendPriceKobo, creatorMarkupKobo, commissionPct } = input;
  if (!Number.isInteger(blendPriceKobo) || blendPriceKobo < 0) {
    throw new Error("Blend price must be a non-negative integer");
  }
  if (!Number.isInteger(creatorMarkupKobo) || creatorMarkupKobo <= 0) {
    throw new Error("Creator markup must be a positive integer");
  }
  if (!(commissionPct >= 0 && commissionPct <= 100)) {
    throw new Error("Commission must be between 0 and 100");
  }
  // Basis points keep fractional percentages (e.g. 12.5%) exact.
  const bps = BigInt(Math.round(commissionPct * 100));
  const commissionKobo = Number((BigInt(creatorMarkupKobo) * bps + 5000n) / 10000n);
  return {
    blendPriceKobo,
    creatorMarkupKobo,
    buyerPriceKobo: blendPriceKobo + creatorMarkupKobo,
    commissionPct,
    commissionKobo,
    platformFeeKobo: blendPriceKobo + commissionKobo,
    sellerEarningKobo: creatorMarkupKobo - commissionKobo,
  };
}
