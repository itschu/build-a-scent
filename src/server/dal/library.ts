import "server-only";
import { randomBytes } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { MixerStep, NoteTier, SavedScentStatus, ListingStatus } from "@/lib/domain";
import type { Formula } from "@/lib/formula";
import { bottleLabel } from "@/lib/labels";
import { blendPriceKobo } from "@/lib/pricing";
import { tierSharesFrom } from "@/lib/settings";
import { getDb, schema } from "@/server/db";
import { getSettings } from "@/server/settings";
import { assertSignedIn, NotFoundError, ValidationError, type Actor } from "./actor";
import { getIngredientsByIds, type CatalogBottleOption, type CatalogIngredient } from "./catalog";

export type ScentIngredient = { id: string; name: string; colorHex: string; tier: NoteTier; isActive: boolean };

export type Availability = { available: true } | { available: false; reason: string };

/**
 * Whether a saved formula can still be ordered, edited, shared or listed: every ingredient
 * active and in its tier, and the bottle option still offered.
 */
export function scentAvailability(
  formula: Formula,
  ingredients: ReadonlyMap<string, CatalogIngredient>,
  bottle: Pick<CatalogBottleOption, "isActive"> | null,
): Availability {
  for (const entry of formula) {
    const ingredient = ingredients.get(entry.ingredientId);
    if (!ingredient || !ingredient.isActive || ingredient.noteTier !== entry.tier) {
      return {
        available: false,
        reason: `${ingredient?.name ?? "An ingredient"} has been discontinued, so this formula can no longer be ordered, edited or listed.`,
      };
    }
  }
  if (!bottle || !bottle.isActive) {
    return { available: false, reason: "This bottle size and format is no longer offered, so this scent can't be reordered." };
  }
  return { available: true };
}

export type LibraryScent = {
  id: string;
  status: SavedScentStatus;
  name: string | null;
  updatedAt: Date;
  currentStep: MixerStep | null;
  ingredients: ScentIngredient[];
  bottle: { id: string; label: string } | null;
  priceKobo: number | null;
  availability: Availability;
  isShared: boolean;
  shareToken: string | null;
  listing: { id: string; status: ListingStatus } | null;
};

/** The actor's saved scents and drafts, newest first. */
export async function listLibrary(actor: Actor): Promise<{ saved: LibraryScent[]; drafts: LibraryScent[] }> {
  assertSignedIn(actor);
  const db = getDb();
  const rows = await db
    .select({
      scent: schema.savedScents,
      listingId: schema.marketplaceListings.id,
      listingStatus: schema.marketplaceListings.status,
    })
    .from(schema.savedScents)
    .leftJoin(schema.marketplaceListings, eq(schema.marketplaceListings.savedScentId, schema.savedScents.id))
    .where(eq(schema.savedScents.userId, actor.userId))
    .orderBy(desc(schema.savedScents.updatedAt));

  const ingredientIds = [...new Set(rows.flatMap((r) => r.scent.formula.map((e) => e.ingredientId)))];
  const bottleIds = [...new Set(rows.map((r) => r.scent.bottleOptionId).filter((id): id is string => Boolean(id)))];
  const [ingredients, bottles, settings] = await Promise.all([
    getIngredientsByIds(ingredientIds),
    bottleIds.length
      ? db.select().from(schema.bottleOptions).where(inArray(schema.bottleOptions.id, bottleIds))
      : Promise.resolve([]),
    getSettings(),
  ]);
  const bottleById = new Map(bottles.map((b) => [b.id, b]));
  const shares = tierSharesFrom(settings);

  const scents = rows.map(({ scent, listingId, listingStatus }): LibraryScent => {
    const bottle = scent.bottleOptionId ? (bottleById.get(scent.bottleOptionId) ?? null) : null;
    const availability =
      scent.status === "saved" ? scentAvailability(scent.formula, ingredients, bottle) : ({ available: true } as const);
    return {
      id: scent.id,
      status: scent.status,
      name: scent.name,
      updatedAt: scent.updatedAt,
      currentStep: scent.currentStep,
      ingredients: scent.formula.flatMap((e) => {
        const i = ingredients.get(e.ingredientId);
        return i ? [{ id: i.id, name: i.name, colorHex: i.colorHex, tier: e.tier, isActive: i.isActive }] : [];
      }),
      bottle: bottle ? { id: bottle.id, label: bottleLabel(bottle) } : null,
      priceKobo:
        scent.status === "saved" && availability.available && bottle
          ? blendPriceKobo(scent.formula, ingredients, bottle, shares)
          : null,
      availability,
      isShared: scent.isShared,
      shareToken: scent.isShared ? scent.shareToken : null,
      listing: listingId && listingStatus ? { id: listingId, status: listingStatus } : null,
    };
  });

  return { saved: scents.filter((s) => s.status === "saved"), drafts: scents.filter((s) => s.status === "draft") };
}

/** Deletes one of the actor's drafts. Saved scents can't be deleted here. */
export async function deleteDraft(actor: Actor, id: string): Promise<void> {
  assertSignedIn(actor);
  const deleted = await getDb()
    .delete(schema.savedScents)
    .where(
      and(
        eq(schema.savedScents.id, id),
        eq(schema.savedScents.userId, actor.userId),
        eq(schema.savedScents.status, "draft"),
      ),
    )
    .returning({ id: schema.savedScents.id });
  if (deleted.length === 0) throw new NotFoundError("Draft not found");
}

function newShareToken(): string {
  return randomBytes(18).toString("base64url");
}

/**
 * Turns a public share link on or off. Each time sharing is turned on a fresh token is
 * issued, so a link that was switched off never starts working again.
 */
export async function setSharing(actor: Actor, id: string, enabled: boolean): Promise<{ shareToken: string | null }> {
  assertSignedIn(actor);
  const db = getDb();
  const [scent] = await db
    .select()
    .from(schema.savedScents)
    .where(and(eq(schema.savedScents.id, id), eq(schema.savedScents.userId, actor.userId)));
  if (!scent || scent.status !== "saved") throw new NotFoundError("Scent not found");

  if (!enabled) {
    await db.update(schema.savedScents).set({ isShared: false }).where(eq(schema.savedScents.id, id));
    return { shareToken: null };
  }

  const ingredients = await getIngredientsByIds(scent.formula.map((e) => e.ingredientId));
  const [bottle] = scent.bottleOptionId
    ? await db.select().from(schema.bottleOptions).where(eq(schema.bottleOptions.id, scent.bottleOptionId))
    : [];
  const availability = scentAvailability(scent.formula, ingredients, bottle ?? null);
  if (!availability.available) throw new ValidationError(availability.reason);

  if (scent.isShared && scent.shareToken) return { shareToken: scent.shareToken };
  const shareToken = newShareToken();
  await db.update(schema.savedScents).set({ isShared: true, shareToken }).where(eq(schema.savedScents.id, id));
  return { shareToken };
}
