import "server-only";
import { and, asc, count, eq, inArray, ne } from "drizzle-orm";
import { z } from "zod";
import { env } from "@/env";
import type { NoteTier } from "@/lib/domain";
import { bottleLabel } from "@/lib/labels";
import { blendPriceKobo, marketplaceSplit, type MarketplaceSplit } from "@/lib/pricing";
import { tierSharesFrom } from "@/lib/settings";
import { getDb, schema, type Tx } from "@/server/db";
import { deliverEmails, queueEmail } from "@/server/email";
import { getSettings } from "@/server/settings";
import { assertAdmin, NotFoundError, ValidationError, type Actor } from "./actor";
import { getIngredientsByIds } from "./catalog";
import { scentAvailability } from "./library";
import { createNotification } from "./notifications";
import { publicNameFor } from "./profiles";

export const PENDING_PAGE_SIZE = 10;

export type PendingListing = {
  id: string;
  name: string;
  description: string;
  submittedAt: Date;
  seller: { name: string; email: string };
  bottleLabel: string;
  /** Admins see the full formula (Tech Plan, Decision 9). */
  formula: Array<{ id: string; name: string; tier: NoteTier; colorHex: string; isActive: boolean; featured: boolean }>;
  split: MarketplaceSplit | null;
  /** Other listings with exactly this formula. */
  duplicates: Array<{ id: string; name: string; sellerName: string; status: string }>;
};

export async function countPendingListings(actor: Actor): Promise<number> {
  assertAdmin(actor);
  const [row] = await getDb()
    .select({ n: count() })
    .from(schema.marketplaceListings)
    .where(eq(schema.marketplaceListings.status, "pending_review"));
  return row.n;
}

/** The review queue, oldest submission first. */
export async function listPendingListings(actor: Actor, page = 1): Promise<{ items: PendingListing[]; total: number }> {
  assertAdmin(actor);
  const db = getDb();
  const total = await countPendingListings(actor);
  const rows = await db
    .select({
      listing: schema.marketplaceListings,
      scent: schema.savedScents,
      bottle: schema.bottleOptions,
      sellerEmail: schema.users.email,
      displayName: schema.profiles.displayName,
      fullName: schema.profiles.fullName,
    })
    .from(schema.marketplaceListings)
    .innerJoin(schema.savedScents, eq(schema.savedScents.id, schema.marketplaceListings.savedScentId))
    .innerJoin(schema.bottleOptions, eq(schema.bottleOptions.id, schema.marketplaceListings.bottleOptionId))
    .innerJoin(schema.users, eq(schema.users.id, schema.marketplaceListings.sellerId))
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.marketplaceListings.sellerId))
    .where(eq(schema.marketplaceListings.status, "pending_review"))
    .orderBy(asc(schema.marketplaceListings.submittedAt))
    .limit(PENDING_PAGE_SIZE)
    .offset((Math.max(1, page) - 1) * PENDING_PAGE_SIZE);

  const ingredients = await getIngredientsByIds([...new Set(rows.flatMap((r) => r.scent.formula.map((e) => e.ingredientId)))]);
  const settings = await getSettings();
  const hashes = rows.map((r) => r.scent.formulaHash).filter((h): h is string => Boolean(h));
  const sameFormula = hashes.length
    ? await db
        .select({
          id: schema.marketplaceListings.id,
          hash: schema.savedScents.formulaHash,
          name: schema.savedScents.name,
          status: schema.marketplaceListings.status,
          displayName: schema.profiles.displayName,
          fullName: schema.profiles.fullName,
        })
        .from(schema.marketplaceListings)
        .innerJoin(schema.savedScents, eq(schema.savedScents.id, schema.marketplaceListings.savedScentId))
        .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.marketplaceListings.sellerId))
        .where(and(inArray(schema.savedScents.formulaHash, hashes), ne(schema.marketplaceListings.status, "withdrawn")))
    : [];

  return {
    total,
    items: rows.map(({ listing, scent, bottle, sellerEmail, displayName, fullName }) => {
      const featured = new Set(listing.featuredIngredientIds);
      const priceable = scentAvailability(scent.formula, ingredients, bottle).available;
      return {
        id: listing.id,
        name: scent.name ?? "Untitled scent",
        description: listing.description,
        submittedAt: listing.submittedAt,
        seller: { name: fullName || publicNameFor({ displayName, fullName }), email: sellerEmail },
        bottleLabel: bottleLabel(bottle),
        formula: scent.formula.map((e) => {
          const i = ingredients.get(e.ingredientId);
          return {
            id: e.ingredientId,
            name: i?.name ?? "Unknown",
            tier: e.tier,
            colorHex: i?.colorHex ?? "#000000",
            isActive: i?.isActive ?? false,
            featured: featured.has(e.ingredientId),
          };
        }),
        split: priceable
          ? marketplaceSplit({
              blendPriceKobo: blendPriceKobo(scent.formula, ingredients, bottle, tierSharesFrom(settings)),
              creatorMarkupKobo: listing.creatorMarkupKobo,
              commissionPct: settings.commission_pct,
            })
          : null,
        duplicates: sameFormula
          .filter((d) => d.hash === scent.formulaHash && d.id !== listing.id)
          .map((d) => ({
            id: d.id,
            name: d.name ?? "Untitled scent",
            sellerName: publicNameFor({ displayName: d.displayName, fullName: d.fullName }),
            status: d.status,
          })),
      };
    }),
  };
}

type Decided = { listingId: string; sellerId: string; sellerEmail: string; sellerName: string; scentName: string; submittedAt: Date };

/** Moves a pending listing to `to`, only if it is still pending (another admin may have acted). */
async function decide(tx: Tx, id: string, set: Partial<typeof schema.marketplaceListings.$inferInsert>): Promise<Decided> {
  const [updated] = await tx
    .update(schema.marketplaceListings)
    .set(set)
    .where(and(eq(schema.marketplaceListings.id, id), eq(schema.marketplaceListings.status, "pending_review")))
    .returning({
      listingId: schema.marketplaceListings.id,
      sellerId: schema.marketplaceListings.sellerId,
      savedScentId: schema.marketplaceListings.savedScentId,
      submittedAt: schema.marketplaceListings.submittedAt,
    });
  if (!updated) {
    const [exists] = await tx.select({ id: schema.marketplaceListings.id }).from(schema.marketplaceListings).where(eq(schema.marketplaceListings.id, id));
    if (!exists) throw new NotFoundError("Listing not found");
    throw new ValidationError("This listing is no longer pending review. Refresh the queue.");
  }
  const [info] = await tx
    .select({
      email: schema.users.email,
      userName: schema.users.name,
      scentName: schema.savedScents.name,
    })
    .from(schema.users)
    .innerJoin(schema.savedScents, eq(schema.savedScents.id, updated.savedScentId))
    .where(eq(schema.users.id, updated.sellerId));
  return {
    listingId: updated.listingId,
    sellerId: updated.sellerId,
    sellerEmail: info.email,
    sellerName: info.userName,
    scentName: info.scentName ?? "Your scent",
    submittedAt: updated.submittedAt,
  };
}

/** Approves a listing: it goes live, and the seller gets a notification and one email. */
export async function approveListing(actor: Actor, id: string): Promise<void> {
  assertAdmin(actor);
  const listingId = z.uuid().parse(id);
  const [seller] = await getDb()
    .select({ bannedAt: schema.users.bannedAt })
    .from(schema.marketplaceListings)
    .innerJoin(schema.users, eq(schema.users.id, schema.marketplaceListings.sellerId))
    .where(eq(schema.marketplaceListings.id, listingId));
  if (seller?.bannedAt) throw new ValidationError("This seller is blocked. Unblock them before approving their listing.");
  await publishPendingListing(listingId);
}

/**
 * Makes a pending listing live and tells the seller (notification + email). Used by admin
 * approval and by automatic approval when the listing_auto_approve setting is on.
 */
export async function publishPendingListing(listingId: string): Promise<void> {
  const emailId = await getDb().transaction(async (tx) => {
    const d = await decide(tx, listingId, { status: "approved", approvedAt: new Date(), rejectionReason: null });
    const url = `${env().APP_URL}/marketplace/${d.listingId}`;
    await createNotification(tx, {
      userId: d.sellerId,
      type: "listing_approved",
      message: `Your scent ${d.scentName} is now live on the marketplace!`,
      link: `/marketplace/${d.listingId}`,
    });
    return queueEmail(tx, {
      // Per submission, so a later resubmission that's approved emails again.
      dedupeKey: `listing_approved:${d.listingId}:${d.submittedAt.toISOString()}`,
      to: d.sellerEmail,
      template: "listing_approved",
      payload: { name: d.sellerName, scentName: d.scentName, url },
    });
  });
  await deliverEmails([emailId]);
}

export const rejectionReasonSchema = z.string().trim().min(1, "Enter a reason for the seller").max(500);

/** Rejects a listing with a required reason the seller sees, so they can fix and resubmit. */
export async function rejectListing(actor: Actor, id: string, reason: string): Promise<void> {
  assertAdmin(actor);
  const listingId = z.uuid().parse(id);
  const why = rejectionReasonSchema.parse(reason);
  const emailId = await getDb().transaction(async (tx) => {
    const d = await decide(tx, listingId, { status: "rejected", rejectionReason: why });
    await createNotification(tx, {
      userId: d.sellerId,
      type: "listing_rejected",
      message: `${d.scentName} wasn't approved: ${why}`,
      link: "/account/seller",
    });
    return queueEmail(tx, {
      dedupeKey: `listing_rejected:${d.listingId}:${d.submittedAt.toISOString()}`,
      to: d.sellerEmail,
      template: "listing_rejected",
      payload: { name: d.sellerName, scentName: d.scentName, reason: why, url: `${env().APP_URL}/account/seller` },
    });
  });
  await deliverEmails([emailId]);
}
