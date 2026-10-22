import { z } from "zod";
import { MAX_INGREDIENTS_PER_TIER, NOTE_TIERS, POUR_STEP_PCT, TIER_MAX_PCT, TIER_MIN_PCT, type NoteTier } from "./domain";

export const formulaEntrySchema = z.object({
  ingredientId: z.uuid(),
  tier: z.enum(NOTE_TIERS),
  /**
   * Share of the whole blend, in percent (5% steps). Absent on formulas saved before
   * proportions existed: those split each tier's platform share equally.
   */
  pct: z.number().int().min(POUR_STEP_PCT).max(TIER_MAX_PCT).multipleOf(POUR_STEP_PCT).optional(),
});
export type FormulaEntry = z.infer<typeof formulaEntrySchema>;
export type Formula = FormulaEntry[];

export function countByTier(formula: Formula): Record<NoteTier, number> {
  const counts: Record<NoteTier, number> = { base: 0, heart: 0, top: 0 };
  for (const entry of formula) counts[entry.tier] += 1;
  return counts;
}

/** True when every entry carries its own amount (a blend made with proportions). */
export function isProportioned(formula: Formula): boolean {
  return formula.length > 0 && formula.every((e) => e.pct !== undefined);
}

/** Percent of the blend in each tier (proportioned formulas only). */
export function pctByTier(formula: Formula): Record<NoteTier, number> {
  const totals: Record<NoteTier, number> = { base: 0, heart: 0, top: 0 };
  for (const entry of formula) totals[entry.tier] += entry.pct ?? 0;
  return totals;
}

export function totalPct(formula: Formula): number {
  return formula.reduce((sum, e) => sum + (e.pct ?? 0), 0);
}

function hasDuplicateIngredients(formula: Formula): boolean {
  return new Set(formula.map((e) => e.ingredientId)).size !== formula.length;
}

const mixedAmounts = (f: Formula) => f.some((e) => e.pct !== undefined) && !isProportioned(f);

/** A draft may be partial: 0–3 ingredients per tier, and a bottle that isn't full yet. */
export const draftFormulaSchema = z
  .array(formulaEntrySchema)
  .refine((f) => !hasDuplicateIngredients(f), "An ingredient can only be used once")
  .refine(
    (f) => Object.values(countByTier(f)).every((n) => n <= MAX_INGREDIENTS_PER_TIER),
    `Each tier can hold at most ${MAX_INGREDIENTS_PER_TIER} ingredients`,
  )
  .refine((f) => !mixedAmounts(f), "Every ingredient needs an amount")
  .refine((f) => totalPct(f) <= 100, "The blend can't be more than 100%")
  .refine(
    (f) => Object.values(pctByTier(f)).every((n) => n <= TIER_MAX_PCT),
    `Each tier can be at most ${TIER_MAX_PCT}% of the blend`,
  );

/**
 * A saved (complete) formula has 1–3 ingredients in every tier. When it has amounts, they
 * fill the bottle exactly and every tier is at least TIER_MIN_PCT.
 */
export const savedFormulaSchema = draftFormulaSchema
  .refine((f) => Object.values(countByTier(f)).every((n) => n >= 1), "Each tier needs at least one ingredient")
  .refine((f) => !isProportioned(f) || totalPct(f) === 100, "The blend must add up to 100%")
  .refine(
    (f) => !isProportioned(f) || Object.values(pctByTier(f)).every((n) => n >= TIER_MIN_PCT),
    `Each tier needs at least ${TIER_MIN_PCT}% of the blend`,
  );

export type CatalogIngredient = { id: string; noteTier: NoteTier; isActive: boolean };

export type FormulaIssue =
  | { kind: "unknown_ingredient"; ingredientId: string }
  | { kind: "inactive_ingredient"; ingredientId: string }
  | { kind: "wrong_tier"; ingredientId: string; expected: NoteTier; actual: NoteTier };

/** Checks a formula against live catalog data. An empty result means the formula is usable. */
export function findFormulaIssues(
  formula: Formula,
  catalog: ReadonlyMap<string, CatalogIngredient>,
): FormulaIssue[] {
  const issues: FormulaIssue[] = [];
  for (const entry of formula) {
    const ingredient = catalog.get(entry.ingredientId);
    if (!ingredient) {
      issues.push({ kind: "unknown_ingredient", ingredientId: entry.ingredientId });
    } else if (!ingredient.isActive) {
      issues.push({ kind: "inactive_ingredient", ingredientId: entry.ingredientId });
    } else if (ingredient.noteTier !== entry.tier) {
      issues.push({
        kind: "wrong_tier",
        ingredientId: entry.ingredientId,
        expected: ingredient.noteTier,
        actual: entry.tier,
      });
    }
  }
  return issues;
}

/**
 * Canonical text form of a formula: ingredient IDs (with their amounts, when the formula has
 * them) sorted within each tier. Different proportions make a different blend. The bottle
 * option is deliberately excluded, so the same blend in another size is a duplicate.
 */
export function canonicalFormula(formula: Formula): string {
  return NOTE_TIERS.map((tier) => {
    const ids = formula
      .filter((e) => e.tier === tier)
      .map((e) => `${e.ingredientId.toLowerCase()}${e.pct === undefined ? "" : `@${e.pct}`}`)
      .sort();
    return `${tier}:${ids.join(",")}`;
  }).join("|");
}

/** SHA-256 (hex) of the canonical formula, used by the duplicate-listing guard. */
export async function formulaHash(formula: Formula): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalFormula(formula));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
