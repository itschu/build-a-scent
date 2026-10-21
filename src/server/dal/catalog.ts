import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { BottleFormat, NoteTier } from "@/lib/domain";
import { getDb, schema, type Db, type Tx } from "@/server/db";

export type CatalogIngredient = {
  id: string;
  name: string;
  noteTier: NoteTier;
  scentFamily: string;
  colorHex: string;
  pricePerMlKobo: number;
  imageUrl: string | null;
  isActive: boolean;
};

export type CatalogBottleOption = {
  id: string;
  sizeLabel: string;
  volumeMl: number;
  format: BottleFormat;
  concentrationPct: number;
  basePriceKobo: number;
  isActive: boolean;
};

const ingredientColumns = {
  id: schema.ingredients.id,
  name: schema.ingredients.name,
  noteTier: schema.ingredients.noteTier,
  scentFamily: schema.ingredients.scentFamily,
  colorHex: schema.ingredients.colorHex,
  pricePerMlKobo: schema.ingredients.pricePerMlKobo,
  imageUrl: schema.ingredients.imageUrl,
  isActive: schema.ingredients.isActive,
};

const bottleOptionColumns = {
  id: schema.bottleOptions.id,
  sizeLabel: schema.bottleOptions.sizeLabel,
  volumeMl: schema.bottleOptions.volumeMl,
  format: schema.bottleOptions.format,
  concentrationPct: schema.bottleOptions.concentrationPct,
  basePriceKobo: schema.bottleOptions.basePriceKobo,
  isActive: schema.bottleOptions.isActive,
};

/** Public read: active ingredients only, ordered for the mixer grid. */
export async function listActiveIngredients(): Promise<CatalogIngredient[]> {
  return getDb()
    .select(ingredientColumns)
    .from(schema.ingredients)
    .where(eq(schema.ingredients.isActive, true))
    .orderBy(asc(schema.ingredients.noteTier), asc(schema.ingredients.name));
}

/** Public read: active bottle options only. */
export async function listActiveBottleOptions(): Promise<CatalogBottleOption[]> {
  return getDb()
    .select(bottleOptionColumns)
    .from(schema.bottleOptions)
    .where(eq(schema.bottleOptions.isActive, true))
    .orderBy(asc(schema.bottleOptions.sortOrder), asc(schema.bottleOptions.volumeMl));
}

/** Server-side lookup including inactive rows, for validation and price checks. */
export async function getIngredientsByIds(
  ids: string[],
  executor: Db | Tx = getDb(),
): Promise<Map<string, CatalogIngredient>> {
  if (ids.length === 0) return new Map();
  const rows = await executor.select(ingredientColumns).from(schema.ingredients).where(inArray(schema.ingredients.id, ids));
  return new Map(rows.map((r) => [r.id, r]));
}

export async function getBottleOption(
  id: string,
  executor: Db | Tx = getDb(),
): Promise<CatalogBottleOption | null> {
  const [row] = await executor.select(bottleOptionColumns).from(schema.bottleOptions).where(eq(schema.bottleOptions.id, id));
  return row ?? null;
}

export async function getActiveBottleOption(id: string, executor: Db | Tx = getDb()) {
  const [row] = await executor
    .select(bottleOptionColumns)
    .from(schema.bottleOptions)
    .where(and(eq(schema.bottleOptions.id, id), eq(schema.bottleOptions.isActive, true)));
  return row ?? null;
}
