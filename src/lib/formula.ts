import { z } from "zod";
import { MAX_INGREDIENTS_PER_TIER, NOTE_TIERS, type NoteTier } from "./domain";

export const formulaEntrySchema = z.object({
  ingredientId: z.uuid(),
  tier: z.enum(NOTE_TIERS),
});
export type FormulaEntry = z.infer<typeof formulaEntrySchema>;
export type Formula = FormulaEntry[];

export function countByTier(formula: Formula): Record<NoteTier, number> {
  const counts: Record<NoteTier, number> = { base: 0, heart: 0, top: 0 };
  for (const entry of formula) counts[entry.tier] += 1;
  return counts;
}

function hasDuplicateIngredients(formula: Formula): boolean {
  return new Set(formula.map((e) => e.ingredientId)).size !== formula.length;
}

/** A draft may be partial: 0–3 ingredients per tier. */
export const draftFormulaSchema = z
  .array(formulaEntrySchema)
  .refine((f) => !hasDuplicateIngredients(f), "An ingredient can only be used once")
  .refine(
    (f) => Object.values(countByTier(f)).every((n) => n <= MAX_INGREDIENTS_PER_TIER),
    `Each tier can hold at most ${MAX_INGREDIENTS_PER_TIER} ingredients`,
  );

/** A saved (complete) formula has 1–3 ingredients in every tier. */
export const savedFormulaSchema = draftFormulaSchema.refine(
  (f) => Object.values(countByTier(f)).every((n) => n >= 1),
  "Each tier needs at least one ingredient",
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
 * Canonical text form of a formula: ingredient IDs sorted within each tier.
 * The bottle option is deliberately excluded, so the same blend in another size is a duplicate.
 */
export function canonicalFormula(formula: Formula): string {
  return NOTE_TIERS.map((tier) => {
    const ids = formula
      .filter((e) => e.tier === tier)
      .map((e) => e.ingredientId.toLowerCase())
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
