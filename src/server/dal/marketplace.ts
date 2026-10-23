import "server-only";
import { and, count, countDistinct, desc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { LISTING_DESCRIPTION_MAX, MAX_FEATURED_NOTES, type ListingStatus, type NoteTier } from "@/lib/domain";
import type { Formula } from "@/lib/formula";
import { bottleLabel } from "@/lib/labels";
import { noteProfile, type NoteProfile } from "@/lib/note-profile";
import { blendPriceKobo, marketplaceSplit, type MarketplaceSplit } from "@/lib/pricing";
import { tierSharesFrom, type SettingValues } from "@/lib/settings";
import { getDb, schema } from "@/server/db";
import { getSettings } from "@/server/settings";
import { assertSignedIn, AuthorizationError, NotFoundError, ValidationError, type Actor } from "./actor";
import { getIngredientsByIds, type CatalogIngredient } from "./catalog";
import { scentAvailability } from "./library";
import { publishPendingListing } from "./moderation";
import { publicNameFor } from "./profiles";

export const DUPLICATE_FORMULA_MESSAGE =
  "A scent with this exact formula is already on the marketplace. Try adjusting your blend.";

function layersOf(formula: Formula, ingredients: ReadonlyMap<string, CatalogIngredient>): Record<NoteTier, string[]> {
  const layers: Record<NoteTier, string[]> = { base: [], heart: [], top: [] };
  for (const e of formula) {
    const color = ingredients.get(e.ingredientId)?.colorHex;
    if (color) layers[e.tier].push(color);
  }
  return layers;
}

// --- Public (recipe-protected) -----------------------------------------------------------

/** What buyers may see of a listing: never the formula (Tech Plan, Decision 9). */
export type PublicListing = {
  id: string;
  name: string;
  description: string;
  creatorName: string;
  sellerId: string;
  bottleLabel: string;
  buyerPriceKobo: number;
  profile: NoteProfile;
  layers: Record<NoteTier, string[]>;
  families: string[];
  featuredNotes: string[];
  approvedAt: Date | null;
};

async function toPublicListings(
  rows: Array<{
    listing: typeof schema.marketplaceListings.$inferSelect;
    name: string | null;
    formula: Formula;
    displayName: string | null;
    fullName: string | null;
    bottle: typeof schema.bottleOptions.$inferSelect;
  }>,
  settings: SettingValues,
): Promise<PublicListing[]> {
  const ingredients = await getIngredientsByIds([...new Set(rows.flatMap((r) => r.formula.map((e) => e.ingredientId)))]);
  const shares = tierSharesFrom(settings);
  return rows.flatMap(({ listing, name, formula, displayName, fullName, bottle }) => {
    // Defence in depth: an approved listing with a discontinued ingredient is never shown.
    if (!scentAvailability(formula, ingredients, bottle).available) return [];
    const profile = noteProfile(formula, ingredients, listing.featuredIngredientIds);
    const split = marketplaceSplit({
      blendPriceKobo: blendPriceKobo(formula, ingredients, bottle, shares),
      creatorMarkupKobo: listing.creatorMarkupKobo,
      commissionPct: settings.commission_pct,
    });
    return [
      {
        id: listing.id,
        name: name ?? "Untitled scent",
        description: listing.description,
        creatorName: publicNameFor({ displayName, fullName }),
        sellerId: listing.sellerId,
        bottleLabel: bottleLabel(bottle),
        buyerPriceKobo: split.buyerPriceKobo,
        profile,
        layers: layersOf(formula, ingredients),
        families: [...new Set(Object.values(profile).flatMap((t) => t.families))],
        featuredNotes: Object.values(profile).flatMap((t) => t.featured),
        approvedAt: listing.approvedAt,
      },
    ];
  });
}

function publicListingQuery() {
  return getDb()
    .select({
      listing: schema.marketplaceListings,
      name: schema.savedScents.name,
      formula: schema.savedScents.formula,
      displayName: schema.profiles.displayName,
      fullName: schema.profiles.fullName,
      bottle: schema.bottleOptions,
    })
    .from(schema.marketplaceListings)
    .innerJoin(schema.savedScents, eq(schema.savedScents.id, schema.marketplaceListings.savedScentId))
    .innerJoin(schema.bottleOptions, eq(schema.bottleOptions.id, schema.marketplaceListings.bottleOptionId))
    .innerJoin(schema.users, eq(schema.users.id, schema.marketplaceListings.sellerId))
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.marketplaceListings.sellerId));
}

/** A listing buyers can see: approved, from a seller who isn't blocked. */
function isLive() {
  return and(eq(schema.marketplaceListings.status, "approved"), isNull(schema.users.bannedAt));
}

/** Public read: approved listings, newest first. */
export async function listMarketplace(): Promise<PublicListing[]> {
  const rows = await publicListingQuery()
    .where(isLive())
    .orderBy(desc(schema.marketplaceListings.approvedAt));
  return toPublicListings(rows, await getSettings());
}

export type PublicListingDetail = PublicListing & {
  creator: { displayName: string; avatarUrl: string | null; bio: string | null };
};

/** Public read of one approved listing; anything else is "unavailable" (null). */
export async function getPublicListing(id: string): Promise<PublicListingDetail | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const rows = await publicListingQuery().where(and(eq(schema.marketplaceListings.id, id), isLive()));
  const [listing] = await toPublicListings(rows, await getSettings());
  if (!listing) return null;
  const [profile] = await getDb()
    .select({ avatarUrl: schema.profiles.avatarUrl, bio: schema.profiles.bio })
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, listing.sellerId));
  return { ...listing, creator: { displayName: listing.creatorName, avatarUrl: profile?.avatarUrl ?? null, bio: profile?.bio ?? null } };
}

// --- Seller ------------------------------------------------------------------------------

export type ListingDraft = {
  scentId: string;
  name: string;
  bottleLabel: string;
  blendPriceKobo: number;
  commissionPct: number;
  minMarkupKobo: number;
  ingredients: Array<{ id: string; name: string; tier: NoteTier; colorHex: string; scentFamily: string }>;
  emailVerified: boolean;
};

async function loadOwnSavedScent(actor: Actor & { kind: "user" }, scentId: string) {
  const db = getDb();
  const [scent] = await db
    .select()
    .from(schema.savedScents)
    .where(and(eq(schema.savedScents.id, scentId), eq(schema.savedScents.userId, actor.userId), eq(schema.savedScents.status, "saved")));
  if (!scent || !scent.bottleOptionId) throw new NotFoundError("Saved scent not found");
  const [bottle] = await db.select().from(schema.bottleOptions).where(eq(schema.bottleOptions.id, scent.bottleOptionId));
  const ingredients = await getIngredientsByIds(scent.formula.map((e) => e.ingredientId));
  const availability = scentAvailability(scent.formula, ingredients, bottle ?? null);
  if (!availability.available) throw new ValidationError(availability.reason);
  return { scent, bottle, ingredients };
}

/** Everything the listing form needs for one of the actor's saved scents. */
export async function getListingDraft(actor: Actor, scentId: string): Promise<ListingDraft> {
  assertSignedIn(actor);
  const { scent, bottle, ingredients } = await loadOwnSavedScent(actor, scentId);
  const [existing] = await getDb()
    .select({ id: schema.marketplaceListings.id })
    .from(schema.marketplaceListings)
    .where(eq(schema.marketplaceListings.savedScentId, scent.id));
  if (existing) throw new ValidationError("This scent already has a listing. Manage it from your seller dashboard.");
  const settings = await getSettings();
  // Shown before the form, so nobody fills it in only to be turned away.
  await assertMayList(actor.userId, settings, { formulaHash: scent.formulaHash });
  return {
    scentId: scent.id,
    name: scent.name ?? "Untitled scent",
    bottleLabel: bottleLabel(bottle),
    blendPriceKobo: blendPriceKobo(scent.formula, ingredients, bottle, tierSharesFrom(settings)),
    commissionPct: settings.commission_pct,
    minMarkupKobo: settings.min_creator_markup_kobo,
    ingredients: scent.formula.map((e) => {
      const i = ingredients.get(e.ingredientId)!;
      return { id: i.id, name: i.name, tier: e.tier, colorHex: i.colorHex, scentFamily: i.scentFamily };
    }),
    emailVerified: actor.emailVerified,
  };
}

export const listingEditSchema = z.object({
  description: z.string().trim().max(LISTING_DESCRIPTION_MAX, `Keep the description under ${LISTING_DESCRIPTION_MAX} characters`),
  creatorMarkupKobo: z.number().int().positive("Set a markup above zero"),
  featuredIngredientIds: z.array(z.uuid()).max(MAX_FEATURED_NOTES, `Choose up to ${MAX_FEATURED_NOTES} featured notes`),
});
export type ListingEdit = z.input<typeof listingEditSchema>;

function assertEdit(edit: z.output<typeof listingEditSchema>, formula: Formula, settings: SettingValues) {
  if (edit.creatorMarkupKobo < settings.min_creator_markup_kobo) {
    throw new ValidationError(`The minimum markup is ₦${(settings.min_creator_markup_kobo / 100).toLocaleString("en-NG")}.`);
  }
  const inFormula = new Set(formula.map((e) => e.ingredientId));
  if (edit.featuredIngredientIds.some((id) => !inFormula.has(id))) {
    throw new ValidationError("Featured notes must be ingredients in this scent.");
  }
}

/** Blocks a listing whose exact formula another seller already has on the marketplace. */
async function assertNotDuplicate(sellerId: string, formulaHash: string | null, exceptListingId?: string) {
  if (!formulaHash) return;
  const [dupe] = await getDb()
    .select({ id: schema.marketplaceListings.id })
    .from(schema.marketplaceListings)
    .innerJoin(schema.savedScents, eq(schema.savedScents.id, schema.marketplaceListings.savedScentId))
    .where(
      and(
        eq(schema.savedScents.formulaHash, formulaHash),
        ne(schema.marketplaceListings.sellerId, sellerId),
        inArray(schema.marketplaceListings.status, ["pending_review", "approved", "unavailable"]),
        exceptListingId ? ne(schema.marketplaceListings.id, exceptListingId) : undefined,
      ),
    )
    .limit(1);
  if (dupe) throw new ValidationError(DUPLICATE_FORMULA_MESSAGE);
}

/** Distinct delivered orders by this user, optionally only those containing a blend. */
export async function deliveredOrderCount(userId: string, formulaHash?: string | null): Promise<number> {
  const db = getDb();
  const [user] = await db.select({ email: schema.users.email }).from(schema.users).where(eq(schema.users.id, userId));
  if (!user) return 0;
  // Orders placed while signed in, plus guest orders placed with the same email address.
  const mine = or(
    eq(schema.orders.userId, userId),
    and(isNull(schema.orders.userId), sql`lower(${schema.orders.email}) = ${user.email.toLowerCase()}`),
  );
  const delivered = and(eq(schema.orders.status, "fulfilled"), mine);
  if (formulaHash === undefined) {
    const [row] = await db.select({ n: count() }).from(schema.orders).where(delivered);
    return row.n;
  }
  if (!formulaHash) return 0;
  const [row] = await db
    .select({ n: countDistinct(schema.orders.id) })
    .from(schema.orders)
    .innerJoin(schema.orderItems, eq(schema.orderItems.orderId, schema.orders.id))
    .where(
      and(
        delivered,
        eq(schema.orderItems.itemType, "custom_scent"),
        sql`${schema.orderItems.itemSnapshot}->>'formulaHash' = ${formulaHash}`,
      ),
    );
  return row.n;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * The platform's selling rules (admin settings): listings may be paused, sellers may have a
 * cap on active listings, and may need delivered orders (of this scent, or of anything)
 * before they can list. `newListing: false` is a resubmission, which skips the orders rule.
 */
async function assertMayList(
  sellerId: string,
  settings: SettingValues,
  scent: { formulaHash: string | null },
  { newListing = true, exceptListingId }: { newListing?: boolean; exceptListingId?: string } = {},
) {
  if (!settings.listings_enabled) throw new ValidationError("New marketplace listings are paused right now. Please check back soon.");
  const max = settings.max_active_listings_per_seller;
  if (max > 0) {
    const [row] = await getDb()
      .select({ n: count() })
      .from(schema.marketplaceListings)
      .where(
        and(
          eq(schema.marketplaceListings.sellerId, sellerId),
          inArray(schema.marketplaceListings.status, ["pending_review", "approved"]),
          exceptListingId ? ne(schema.marketplaceListings.id, exceptListingId) : undefined,
        ),
      );
    if (row.n >= max) {
      throw new ValidationError(`You can have up to ${plural(max, "active listing")}. Withdraw one to list another.`);
    }
  }
  const need = settings.listing_required_orders;
  if (!newListing || need === 0) return;
  const sameScent = settings.listing_order_scope === "same_scent";
  const have = await deliveredOrderCount(sellerId, sameScent ? scent.formulaHash : undefined);
  if (have < need) {
    throw new ValidationError(
      sameScent
        ? `To list this scent, you need ${plural(need, "delivered order")} of it first, so you know exactly what buyers will get. You have ${have} so far.`
        : `You need ${plural(need, "delivered order")} on Build a Scent before you can list scents for sale. You have ${have} so far.`,
    );
  }
}

function assertVerified(actor: Actor & { kind: "user" }) {
  if (!actor.emailVerified) throw new AuthorizationError("Verify your email address before listing scents for sale.");
}

/**
 * Submits one of the actor's saved scents for review (Flow 5), or publishes it straight away
 * when listings are approved automatically.
 */
export async function submitListing(
  actor: Actor,
  input: ListingEdit & { scentId: string },
): Promise<{ id: string; status: "pending_review" | "approved" }> {
  assertSignedIn(actor);
  assertVerified(actor);
  const edit = listingEditSchema.parse(input);
  const { scent } = await loadOwnSavedScent(actor, z.uuid().parse(input.scentId));
  const settings = await getSettings();
  assertEdit(edit, scent.formula, settings);
  await assertMayList(actor.userId, settings, { formulaHash: scent.formulaHash });
  await assertNotDuplicate(actor.userId, scent.formulaHash);

  const [created] = await getDb()
    .insert(schema.marketplaceListings)
    .values({
      savedScentId: scent.id,
      sellerId: actor.userId,
      bottleOptionId: scent.bottleOptionId!,
      ...edit,
      status: "pending_review",
      submittedAt: new Date(),
    })
    .onConflictDoNothing()
    .returning({ id: schema.marketplaceListings.id });
  if (!created) throw new ValidationError("This scent already has a listing. Manage it from your seller dashboard.");
  if (!settings.listing_auto_approve) return { id: created.id, status: "pending_review" };
  await publishPendingListing(created.id);
  return { id: created.id, status: "approved" };
}

async function ownListing(actor: Actor & { kind: "user" }, id: string) {
  const [row] = await getDb()
    .select({ listing: schema.marketplaceListings, formula: schema.savedScents.formula, formulaHash: schema.savedScents.formulaHash })
    .from(schema.marketplaceListings)
    .innerJoin(schema.savedScents, eq(schema.savedScents.id, schema.marketplaceListings.savedScentId))
    .where(and(eq(schema.marketplaceListings.id, id), eq(schema.marketplaceListings.sellerId, actor.userId)));
  if (!row) throw new NotFoundError("Listing not found");
  return row;
}

/**
 * Edit & resubmit a rejected listing, or relist a withdrawn one. Only the description, markup
 * and featured notes can change; the formula is locked (Tech Plan, Decision 12).
 */
export async function resubmitListing(actor: Actor, id: string, input: ListingEdit): Promise<{ status: "pending_review" | "approved" }> {
  assertSignedIn(actor);
  assertVerified(actor);
  const edit = listingEditSchema.parse(input);
  const { listing, formula, formulaHash } = await ownListing(actor, id);
  if (listing.status !== "rejected" && listing.status !== "withdrawn") {
    throw new ValidationError("Only rejected or withdrawn listings can be resubmitted.");
  }
  const settings = await getSettings();
  assertEdit(edit, formula, settings);
  await assertMayList(actor.userId, settings, { formulaHash }, { newListing: false, exceptListingId: id });
  await assertNotDuplicate(actor.userId, formulaHash, id);
  const ingredients = await getIngredientsByIds(formula.map((e) => e.ingredientId));
  const [bottle] = await getDb().select().from(schema.bottleOptions).where(eq(schema.bottleOptions.id, listing.bottleOptionId));
  const availability = scentAvailability(formula, ingredients, bottle ?? null);
  if (!availability.available) throw new ValidationError(availability.reason);

  const updated = await getDb()
    .update(schema.marketplaceListings)
    .set({ ...edit, status: "pending_review", rejectionReason: null, submittedAt: new Date() })
    .where(and(eq(schema.marketplaceListings.id, id), inArray(schema.marketplaceListings.status, ["rejected", "withdrawn"])))
    .returning({ id: schema.marketplaceListings.id });
  if (updated.length === 0) throw new ValidationError("This listing changed. Refresh and try again.");
  if (!settings.listing_auto_approve) return { status: "pending_review" };
  await publishPendingListing(id);
  return { status: "approved" };
}

/** Takes a listing off the marketplace / out of the review queue. Returns whether it was live. */
export async function withdrawListing(actor: Actor, id: string): Promise<{ wasLive: boolean }> {
  assertSignedIn(actor);
  const { listing } = await ownListing(actor, id);
  const updated = await getDb()
    .update(schema.marketplaceListings)
    .set({ status: "withdrawn" })
    .where(
      and(
        eq(schema.marketplaceListings.id, id),
        inArray(schema.marketplaceListings.status, ["pending_review", "approved", "rejected", "unavailable"]),
      ),
    )
    .returning({ id: schema.marketplaceListings.id });
  if (updated.length === 0) throw new ValidationError("This listing is already withdrawn.");
  return { wasLive: listing.status === "approved" };
}

export type SellerListing = {
  id: string;
  name: string;
  status: ListingStatus;
  description: string;
  creatorMarkupKobo: number;
  featuredIngredientIds: string[];
  rejectionReason: string | null;
  unavailableReason: string | null;
  submittedAt: Date;
  bottleLabel: string;
  /** At current prices and commission; null if the formula can no longer be priced. */
  split: MarketplaceSplit | null;
  ingredients: Array<{ id: string; name: string; tier: NoteTier }>;
  layers: Record<NoteTier, string[]>;
};

export type SellerEarnings = {
  pendingKobo: number;
  availableKobo: number;
  entries: Array<{
    id: string;
    createdAt: Date;
    amountKobo: number;
    entryType: string;
    status: string;
    listingName: string;
    orderNumber: string;
  }>;
};

export async function getSellerDashboard(actor: Actor): Promise<{
  listings: SellerListing[];
  earnings: SellerEarnings;
  commissionPct: number;
  minMarkupKobo: number;
}> {
  assertSignedIn(actor);
  const db = getDb();
  const rows = await db
    .select({
      listing: schema.marketplaceListings,
      name: schema.savedScents.name,
      formula: schema.savedScents.formula,
      bottle: schema.bottleOptions,
    })
    .from(schema.marketplaceListings)
    .innerJoin(schema.savedScents, eq(schema.savedScents.id, schema.marketplaceListings.savedScentId))
    .innerJoin(schema.bottleOptions, eq(schema.bottleOptions.id, schema.marketplaceListings.bottleOptionId))
    .where(eq(schema.marketplaceListings.sellerId, actor.userId))
    .orderBy(desc(schema.marketplaceListings.submittedAt));
  const ingredients = await getIngredientsByIds([...new Set(rows.flatMap((r) => r.formula.map((e) => e.ingredientId)))]);
  const settings = await getSettings();
  const shares = tierSharesFrom(settings);

  const listings = rows.map(({ listing, name, formula, bottle }): SellerListing => {
    const priceable = scentAvailability(formula, ingredients, bottle).available;
    return {
      id: listing.id,
      name: name ?? "Untitled scent",
      status: listing.status,
      description: listing.description,
      creatorMarkupKobo: listing.creatorMarkupKobo,
      featuredIngredientIds: listing.featuredIngredientIds,
      rejectionReason: listing.rejectionReason,
      unavailableReason: listing.unavailableReason,
      submittedAt: listing.submittedAt,
      bottleLabel: bottleLabel(bottle),
      split: priceable
        ? marketplaceSplit({
            blendPriceKobo: blendPriceKobo(formula, ingredients, bottle, shares),
            creatorMarkupKobo: listing.creatorMarkupKobo,
            commissionPct: settings.commission_pct,
          })
        : null,
      ingredients: formula.map((e) => ({ id: e.ingredientId, name: ingredients.get(e.ingredientId)?.name ?? "Unknown", tier: e.tier })),
      layers: layersOf(formula, ingredients),
    };
  });

  const entries = await db
    .select({
      id: schema.sellerEarningsLedger.id,
      createdAt: schema.sellerEarningsLedger.createdAt,
      amountKobo: schema.sellerEarningsLedger.amountKobo,
      entryType: schema.sellerEarningsLedger.entryType,
      status: schema.sellerEarningsLedger.status,
      listingName: sql<string>`coalesce(${schema.savedScents.name}, 'Untitled scent')`,
      orderNumber: schema.orders.orderNumber,
    })
    .from(schema.sellerEarningsLedger)
    .innerJoin(schema.orders, eq(schema.orders.id, schema.sellerEarningsLedger.orderId))
    .innerJoin(schema.marketplaceListings, eq(schema.marketplaceListings.id, schema.sellerEarningsLedger.marketplaceListingId))
    .innerJoin(schema.savedScents, eq(schema.savedScents.id, schema.marketplaceListings.savedScentId))
    .where(eq(schema.sellerEarningsLedger.sellerId, actor.userId))
    .orderBy(desc(schema.sellerEarningsLedger.createdAt))
    .limit(100);
  const [profile] = await db
    .select({ available: schema.profiles.sellerAvailableKobo })
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, actor.userId));
  const [pending] = await db
    .select({ total: sql<number>`coalesce(sum(${schema.sellerEarningsLedger.amountKobo}), 0)::bigint` })
    .from(schema.sellerEarningsLedger)
    .where(and(eq(schema.sellerEarningsLedger.sellerId, actor.userId), eq(schema.sellerEarningsLedger.status, "pending")));

  return {
    listings,
    earnings: { pendingKobo: Number(pending.total), availableKobo: profile?.available ?? 0, entries },
    commissionPct: settings.commission_pct,
    minMarkupKobo: settings.min_creator_markup_kobo,
  };
}
