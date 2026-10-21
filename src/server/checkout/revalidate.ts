import "server-only";
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import type { NoteTier, OrderItemType } from "@/lib/domain";
import { findFormulaIssues, type Formula } from "@/lib/formula";
import { bottleLabel, FORMAT_LABELS } from "@/lib/labels";
import { noteProfile } from "@/lib/note-profile";
import type { ItemSnapshot, SnapshotBottle, SnapshotIngredient } from "@/lib/order-snapshot";
import { blendPriceKobo, ingredientCostKobo, marketplaceSplit } from "@/lib/pricing";
import { tierSharesFrom, type SettingValues } from "@/lib/settings";
import type { CheckoutLine } from "@/lib/validation/checkout";
import { schema, type Tx } from "@/server/db";
import { getIngredientsByIds, type CatalogIngredient } from "@/server/dal/catalog";
import { publicNameFor } from "@/server/dal/profiles";

export type PricedLine = {
  key: string;
  itemType: OrderItemType;
  referenceId: string;
  quantity: number;
  unitPriceKobo: number;
  snapshot: ItemSnapshot;
  /** Standard products only: needed for stock deduction and reservations. */
  variantId?: string;
  /** Standard products only: stock available to this order right now. */
  availableStock?: number;
};

export type LineIssue =
  | { key: string; kind: "unavailable"; message: string }
  | { key: string; kind: "price_changed"; message: string; newPriceKobo: number }
  | { key: string; kind: "quantity_reduced"; message: string; newQuantity: number };

export type RevalidationResult = { lines: PricedLine[]; issues: LineIssue[] };

function snapshotBottle(b: { id: string; sizeLabel: string; volumeMl: number; format: SnapshotBottle["format"] }): SnapshotBottle {
  return { id: b.id, label: bottleLabel(b), volumeMl: b.volumeMl, format: b.format };
}

function snapshotFormula(formula: Formula, ingredients: ReadonlyMap<string, CatalogIngredient>): SnapshotIngredient[] {
  return formula.map((e) => {
    const i = ingredients.get(e.ingredientId)!;
    return { ingredientId: i.id, name: i.name, tier: e.tier, colorHex: i.colorHex };
  });
}

function colorsByTier(formula: SnapshotIngredient[]): Record<NoteTier, string[]> {
  return {
    base: formula.filter((i) => i.tier === "base").map((i) => i.colorHex),
    heart: formula.filter((i) => i.tier === "heart").map((i) => i.colorHex),
    top: formula.filter((i) => i.tier === "top").map((i) => i.colorHex),
  };
}

function priceIssue(line: CheckoutLine, unitPriceKobo: number, name: string): LineIssue | null {
  if (line.displayPriceKobo === unitPriceKobo) return null;
  return { key: line.key, kind: "price_changed", message: `The price of ${name} has changed.`, newPriceKobo: unitPriceKobo };
}

/**
 * Strict checkout revalidation (Tech Plan, Decision 15). Every line is re-priced and
 * re-checked against live data inside the order transaction; product variants are locked so
 * concurrent checkouts can't both claim the last bottles.
 */
export async function revalidateCart(tx: Tx, lines: CheckoutLine[], settings: SettingValues): Promise<RevalidationResult> {
  const priced: PricedLine[] = [];
  const issues: LineIssue[] = [];
  const shares = tierSharesFrom(settings);

  const listingIds = lines.flatMap((l) => (l.type === "marketplace_listing" ? [l.listingId] : []));
  const variantIds = lines.flatMap((l) => (l.type === "standard_product" ? [l.variantId] : []));
  const bottleIds = lines.flatMap((l) => (l.type === "custom_scent" ? [l.bottleOptionId] : []));

  const listings = listingIds.length
    ? await tx
        .select({
          listing: schema.marketplaceListings,
          scentName: schema.savedScents.name,
          formula: schema.savedScents.formula,
          displayName: schema.profiles.displayName,
          fullName: schema.profiles.fullName,
        })
        .from(schema.marketplaceListings)
        .innerJoin(schema.savedScents, eq(schema.savedScents.id, schema.marketplaceListings.savedScentId))
        .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.marketplaceListings.sellerId))
        .where(inArray(schema.marketplaceListings.id, listingIds))
    : [];
  const listingById = new Map(listings.map((l) => [l.listing.id, l]));

  const allBottleIds = [...bottleIds, ...listings.map((l) => l.listing.bottleOptionId)];
  const bottles = allBottleIds.length
    ? await tx.select().from(schema.bottleOptions).where(inArray(schema.bottleOptions.id, allBottleIds))
    : [];
  const bottleById = new Map(bottles.map((b) => [b.id, b]));

  const ingredientIds = [
    ...lines.flatMap((l) => (l.type === "custom_scent" ? l.formula.map((e) => e.ingredientId) : [])),
    ...listings.flatMap((l) => l.formula.map((e) => e.ingredientId)),
  ];
  const ingredients = await getIngredientsByIds([...new Set(ingredientIds)], tx);

  // Lock variants so stock checks and reservations are consistent across concurrent checkouts.
  const variants = variantIds.length
    ? await tx
        .select({ variant: schema.productVariants, product: schema.products })
        .from(schema.productVariants)
        .innerJoin(schema.products, eq(schema.products.id, schema.productVariants.productId))
        .where(inArray(schema.productVariants.id, variantIds))
        .for("update", { of: schema.productVariants })
    : [];
  const variantById = new Map(variants.map((v) => [v.variant.id, v]));
  const reserved = variantIds.length
    ? await tx
        .select({
          variantId: schema.inventoryReservations.productVariantId,
          quantity: sql<number>`coalesce(sum(${schema.inventoryReservations.quantity}), 0)::int`,
        })
        .from(schema.inventoryReservations)
        .where(
          and(
            inArray(schema.inventoryReservations.productVariantId, variantIds),
            eq(schema.inventoryReservations.status, "active"),
            gt(schema.inventoryReservations.expiresAt, new Date()),
          ),
        )
        .groupBy(schema.inventoryReservations.productVariantId)
    : [];
  const reservedByVariant = new Map(reserved.map((r) => [r.variantId, r.quantity]));

  for (const line of lines) {
    if (line.type === "custom_scent") {
      const bottle = bottleById.get(line.bottleOptionId);
      if (findFormulaIssues(line.formula, ingredients).length > 0 || !bottle?.isActive) {
        issues.push({ key: line.key, kind: "unavailable", message: `${line.name} uses an ingredient or bottle that's no longer available.` });
        continue;
      }
      const unit = blendPriceKobo(line.formula, ingredients, bottle, shares);
      const issue = priceIssue(line, unit, line.name);
      if (issue) issues.push(issue);
      priced.push({
        key: line.key,
        itemType: "custom_scent",
        referenceId: bottle.id,
        quantity: line.quantity,
        unitPriceKobo: unit,
        snapshot: {
          type: "custom_scent",
          name: line.name,
          bottle: snapshotBottle(bottle),
          formula: snapshotFormula(line.formula, ingredients),
          basePriceKobo: bottle.basePriceKobo,
          ingredientCostKobo: ingredientCostKobo(line.formula, ingredients, bottle, shares),
        },
      });
    } else if (line.type === "marketplace_listing") {
      const found = listingById.get(line.listingId);
      const bottle = found && bottleById.get(found.listing.bottleOptionId);
      if (
        !found ||
        !bottle?.isActive ||
        found.listing.status !== "approved" ||
        findFormulaIssues(found.formula, ingredients).length > 0
      ) {
        issues.push({ key: line.key, kind: "unavailable", message: `${found?.scentName ?? "A marketplace scent"} is no longer available.` });
        continue;
      }
      const name = found.scentName ?? "Marketplace scent";
      const split = marketplaceSplit({
        blendPriceKobo: blendPriceKobo(found.formula, ingredients, bottle, shares),
        creatorMarkupKobo: found.listing.creatorMarkupKobo,
        commissionPct: settings.commission_pct,
      });
      const issue = priceIssue(line, split.buyerPriceKobo, name);
      if (issue) issues.push(issue);
      const formula = snapshotFormula(found.formula, ingredients);
      priced.push({
        key: line.key,
        itemType: "marketplace_listing",
        referenceId: found.listing.id,
        quantity: line.quantity,
        unitPriceKobo: split.buyerPriceKobo,
        snapshot: {
          type: "marketplace_listing",
          name,
          listingId: found.listing.id,
          sellerId: found.listing.sellerId,
          creatorName: publicNameFor({ displayName: found.displayName, fullName: found.fullName }),
          bottle: snapshotBottle(bottle),
          formula,
          profile: noteProfile(found.formula, ingredients, found.listing.featuredIngredientIds),
          colors: colorsByTier(formula),
          split,
        },
      });
    } else {
      const found = variantById.get(line.variantId);
      if (!found || !found.variant.isActive || !found.product.isActive) {
        issues.push({ key: line.key, kind: "unavailable", message: `${found?.product.name ?? "A product"} is no longer available.` });
        continue;
      }
      const { variant, product } = found;
      const available = Math.max(0, variant.stockQty - (reservedByVariant.get(variant.id) ?? 0));
      if (available === 0) {
        issues.push({ key: line.key, kind: "unavailable", message: `${product.name} is out of stock.` });
        continue;
      }
      if (available < line.quantity) {
        issues.push({
          key: line.key,
          kind: "quantity_reduced",
          message: `Only ${available} of ${product.name} left, so we've updated your quantity.`,
          newQuantity: available,
        });
      }
      const issue = priceIssue(line, variant.priceKobo, product.name);
      if (issue) issues.push(issue);
      priced.push({
        key: line.key,
        itemType: "standard_product",
        referenceId: variant.id,
        variantId: variant.id,
        availableStock: available,
        quantity: Math.min(line.quantity, available),
        unitPriceKobo: variant.priceKobo,
        snapshot: {
          type: "standard_product",
          name: product.name,
          productId: product.id,
          variantId: variant.id,
          variantLabel: `${variant.sizeLabel} · ${FORMAT_LABELS[variant.format]}`,
          imageUrl: product.images[0] ?? null,
          notes: product.notes,
        },
      });
    }
  }

  return { lines: priced, issues };
}
