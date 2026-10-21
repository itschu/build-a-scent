// Recipe protection (Tech Plan, Decision 9): buyers of a marketplace scent see the scent
// families of each tier plus up to 3 featured notes the seller chose, never the formula.
import { NOTE_TIERS, type NoteTier } from "./domain";
import type { Formula } from "./formula";

export type NoteProfile = Record<NoteTier, { families: string[]; featured: string[] }>;

export function noteProfile(
  formula: Formula,
  ingredients: ReadonlyMap<string, { name: string; scentFamily: string }>,
  featuredIngredientIds: readonly string[],
): NoteProfile {
  const featured = new Set(featuredIngredientIds);
  const profile = Object.fromEntries(NOTE_TIERS.map((t) => [t, { families: [] as string[], featured: [] as string[] }])) as NoteProfile;
  for (const entry of formula) {
    const ingredient = ingredients.get(entry.ingredientId);
    if (!ingredient) continue;
    const tier = profile[entry.tier];
    if (!tier.families.includes(ingredient.scentFamily)) tier.families.push(ingredient.scentFamily);
    if (featured.has(entry.ingredientId)) tier.featured.push(ingredient.name);
  }
  return profile;
}
