import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import type { NoteTier } from "@/lib/domain";
import type { Formula } from "@/lib/formula";
import { bottleLabel } from "@/lib/labels";
import { noteProfile, type NoteProfile } from "@/lib/note-profile";
import { blendPriceKobo } from "@/lib/pricing";
import { tierSharesFrom } from "@/lib/settings";
import { getDb, schema } from "@/server/db";
import { getSettings } from "@/server/settings";
import { getIngredientsByIds } from "./catalog";
import { scentAvailability, type Availability, type ScentIngredient } from "./library";
import { publicNameFor } from "./profiles";

type SharedBase = {
  name: string;
  creatorName: string;
  bottle: { id: string; label: string } | null;
  availability: Availability;
  /** Layer colours only; safe to show even when the formula is protected. */
  layers: Record<NoteTier, string[]>;
};

/**
 * A publicly shared scent. When it has a live marketplace listing, the formula is withheld
 * (only the note profile is returned) and buyers are sent to the listing instead. Scents of
 * blocked or deleted accounts aren't available.
 */
export type SharedScent =
  | (SharedBase & { kind: "formula"; ingredients: ScentIngredient[]; formula: Formula; priceKobo: number | null })
  | (SharedBase & { kind: "listed"; listingId: string; profile: NoteProfile });

export async function getSharedScent(token: string): Promise<SharedScent | null> {
  const db = getDb();
  const [row] = await db
    .select({
      scent: schema.savedScents,
      displayName: schema.profiles.displayName,
      fullName: schema.profiles.fullName,
      listingId: schema.marketplaceListings.id,
      listingStatus: schema.marketplaceListings.status,
      featured: schema.marketplaceListings.featuredIngredientIds,
    })
    .from(schema.savedScents)
    .innerJoin(schema.users, eq(schema.users.id, schema.savedScents.userId))
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.savedScents.userId))
    .leftJoin(schema.marketplaceListings, eq(schema.marketplaceListings.savedScentId, schema.savedScents.id))
    .where(
      and(
        eq(schema.savedScents.shareToken, token),
        eq(schema.savedScents.isShared, true),
        eq(schema.savedScents.status, "saved"),
        // Deleted accounts are also blocked, so this covers both.
        isNull(schema.users.bannedAt),
      ),
    );
  if (!row) return null;

  const { scent } = row;
  const ingredients = await getIngredientsByIds(scent.formula.map((e) => e.ingredientId));
  const [bottle] = scent.bottleOptionId
    ? await db.select().from(schema.bottleOptions).where(eq(schema.bottleOptions.id, scent.bottleOptionId))
    : [];
  const availability = scentAvailability(scent.formula, ingredients, bottle ?? null);
  const layers: Record<NoteTier, string[]> = { base: [], heart: [], top: [] };
  for (const e of scent.formula) {
    const color = ingredients.get(e.ingredientId)?.colorHex;
    if (color) layers[e.tier].push(color);
  }
  const base: SharedBase = {
    name: scent.name ?? "Untitled scent",
    creatorName: publicNameFor({ displayName: row.displayName, fullName: row.fullName }),
    bottle: bottle ? { id: bottle.id, label: bottleLabel(bottle) } : null,
    availability,
    layers,
  };

  if (row.listingId && row.listingStatus === "approved") {
    return { ...base, kind: "listed", listingId: row.listingId, profile: noteProfile(scent.formula, ingredients, row.featured ?? []) };
  }

  const settings = await getSettings();
  return {
    ...base,
    kind: "formula",
    formula: scent.formula,
    ingredients: scent.formula.flatMap((e) => {
      const i = ingredients.get(e.ingredientId);
      return i ? [{ id: i.id, name: i.name, colorHex: i.colorHex, tier: e.tier, isActive: i.isActive, pct: e.pct }] : [];
    }),
    priceKobo: availability.available && bottle ? blendPriceKobo(scent.formula, ingredients, bottle, tierSharesFrom(settings)) : null,
  };
}
