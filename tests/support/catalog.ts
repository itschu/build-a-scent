import { eq } from "drizzle-orm";
import type { ScriptDb } from "../../scripts/db";
import * as schema from "../../src/server/db/schema";

/** Seeded sample ingredients and bottle options by name, for building formulas in tests. */
export async function loadCatalog(db: ScriptDb) {
  const ingredients = await db.select().from(schema.ingredients);
  const bottles = await db.select().from(schema.bottleOptions);
  const ing = (name: string) => {
    const found = ingredients.find((i) => i.name === name);
    if (!found) throw new Error(`No ingredient ${name}`);
    return found;
  };
  const bottle = (volumeMl: number, format: string) => {
    const found = bottles.find((b) => b.volumeMl === volumeMl && b.format === format);
    if (!found) throw new Error(`No bottle ${volumeMl} ${format}`);
    return found;
  };
  const entry = (name: string) => ({ ingredientId: ing(name).id, tier: ing(name).noteTier });
  return { ing, bottle, entry };
}

export async function setIngredientActive(db: ScriptDb, id: string, isActive: boolean) {
  await db.update(schema.ingredients).set({ isActive }).where(eq(schema.ingredients.id, id));
}
