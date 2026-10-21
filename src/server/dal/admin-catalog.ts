import "server-only";
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { env } from "@/env";
import { BOTTLE_FORMATS, NOTE_TIERS } from "@/lib/domain";
import { bottleLabel } from "@/lib/labels";
import { getDb, schema, type Tx } from "@/server/db";
import { deliverEmails, queueEmail } from "@/server/email";
import { assertAdmin, NotFoundError, ValidationError, type Actor } from "./actor";
import { getIngredientsByIds } from "./catalog";
import { scentAvailability } from "./library";
import { createNotification } from "./notifications";

// --- Ingredients -------------------------------------------------------------------------

export const ingredientInputSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(40),
  noteTier: z.enum(NOTE_TIERS),
  scentFamily: z.string().trim().min(2, "Scent family is required").max(30),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #c06080"),
  pricePerMlKobo: z.number().int().min(0, "Price can't be negative"),
  imageUrl: z.url({ protocol: /^https?$/ }).nullable(),
});
export type IngredientInput = z.input<typeof ingredientInputSchema>;

export type AdminIngredient = typeof schema.ingredients.$inferSelect & { referenced: boolean; usedBy: number };

/** Saved scents (incl. drafts) whose formula uses the ingredient. */
function scentsUsing(ingredientId: string) {
  return sql`(select count(*)::int from ${schema.savedScents} where ${schema.savedScents.formula} @> ${JSON.stringify([{ ingredientId }])}::jsonb)`;
}

function ordersUsing(ingredientId: string) {
  return sql`(select count(*)::int from ${schema.orderItems} where ${schema.orderItems.itemSnapshot} -> 'formula' @> ${JSON.stringify([{ ingredientId }])}::jsonb)`;
}

export async function listIngredientsForAdmin(actor: Actor): Promise<AdminIngredient[]> {
  assertAdmin(actor);
  const rows = await getDb()
    .select({
      ingredient: schema.ingredients,
      usedBy: sql<number>`(select count(*)::int from ${schema.savedScents} s where s.formula @> jsonb_build_array(jsonb_build_object('ingredientId', ${schema.ingredients.id})))`,
      ordered: sql<number>`(select count(*)::int from ${schema.orderItems} oi where oi.item_snapshot -> 'formula' @> jsonb_build_array(jsonb_build_object('ingredientId', ${schema.ingredients.id})))`,
    })
    .from(schema.ingredients)
    .orderBy(asc(schema.ingredients.noteTier), asc(schema.ingredients.name));
  return rows.map((r) => ({ ...r.ingredient, usedBy: r.usedBy, referenced: r.usedBy + r.ordered > 0 }));
}

async function isReferenced(tx: Tx, ingredientId: string): Promise<boolean> {
  const [row] = await tx.execute<{ scents: number; orders: number }>(
    sql`select ${scentsUsing(ingredientId)} as scents, ${ordersUsing(ingredientId)} as orders`,
  ).then((r) => r.rows);
  return row.scents + row.orders > 0;
}

export async function saveIngredient(actor: Actor, input: IngredientInput & { id?: string }): Promise<{ id: string }> {
  assertAdmin(actor);
  const data = ingredientInputSchema.parse(input);
  return getDb().transaction(async (tx) => {
    const [clash] = await tx
      .select({ id: schema.ingredients.id })
      .from(schema.ingredients)
      .where(and(sql`lower(${schema.ingredients.name}) = lower(${data.name})`, input.id ? ne(schema.ingredients.id, input.id) : undefined));
    if (clash) throw new ValidationError("An ingredient with that name already exists.");

    if (!input.id) {
      const [created] = await tx.insert(schema.ingredients).values(data).returning({ id: schema.ingredients.id });
      return created;
    }
    const [current] = await tx.select().from(schema.ingredients).where(eq(schema.ingredients.id, input.id));
    if (!current) throw new NotFoundError("Ingredient not found");
    // Moving a used ingredient to another tier would silently break every formula using it.
    if (current.noteTier !== data.noteTier && (await isReferenced(tx, input.id))) {
      throw new ValidationError("This ingredient is used in saved scents or orders, so its tier can't change. Create a new ingredient instead.");
    }
    await tx.update(schema.ingredients).set(data).where(eq(schema.ingredients.id, input.id));
    return { id: input.id };
  });
}

/** Hard delete, only for ingredients no scent or order has ever used; otherwise deactivate. */
export async function deleteIngredient(actor: Actor, id: string): Promise<void> {
  assertAdmin(actor);
  await getDb().transaction(async (tx) => {
    if (await isReferenced(tx, id)) {
      throw new ValidationError("This ingredient has been used in scents or orders. Deactivate it instead.");
    }
    const deleted = await tx.delete(schema.ingredients).where(eq(schema.ingredients.id, id)).returning({ id: schema.ingredients.id });
    if (deleted.length === 0) throw new NotFoundError("Ingredient not found");
  });
}

export async function setIngredientActive(actor: Actor, id: string, isActive: boolean): Promise<CascadeResult> {
  assertAdmin(actor);
  const { result, emailIds } = await getDb().transaction(async (tx) => {
    const updated = await tx.update(schema.ingredients).set({ isActive }).where(eq(schema.ingredients.id, id)).returning({ id: schema.ingredients.id });
    if (updated.length === 0) throw new NotFoundError("Ingredient not found");
    return syncListingAvailability(tx);
  });
  await deliverEmails(emailIds);
  return result;
}

// --- Bottle options ----------------------------------------------------------------------

export const bottleOptionInputSchema = z.object({
  volumeMl: z.number().int().positive("Volume must be positive").max(1000),
  format: z.enum(BOTTLE_FORMATS),
  concentrationPct: z.number().int().min(1).max(100),
  basePriceKobo: z.number().int().min(0, "Price can't be negative"),
  sortOrder: z.number().int().min(0).default(0),
});
export type BottleOptionInput = z.input<typeof bottleOptionInputSchema>;

export async function listBottleOptionsForAdmin(actor: Actor) {
  assertAdmin(actor);
  return getDb()
    .select()
    .from(schema.bottleOptions)
    .orderBy(asc(schema.bottleOptions.sortOrder), asc(schema.bottleOptions.volumeMl));
}

export async function saveBottleOption(actor: Actor, input: BottleOptionInput & { id?: string }): Promise<{ id: string }> {
  assertAdmin(actor);
  const data = bottleOptionInputSchema.parse(input);
  const values = { ...data, sizeLabel: `${data.volumeMl}ml` };
  const db = getDb();
  const [clash] = await db
    .select({ id: schema.bottleOptions.id })
    .from(schema.bottleOptions)
    .where(
      and(
        eq(schema.bottleOptions.volumeMl, data.volumeMl),
        eq(schema.bottleOptions.format, data.format),
        input.id ? ne(schema.bottleOptions.id, input.id) : undefined,
      ),
    );
  if (clash) throw new ValidationError(`A ${bottleLabel(values)} option already exists.`);
  if (input.id) {
    const updated = await db.update(schema.bottleOptions).set(values).where(eq(schema.bottleOptions.id, input.id)).returning({ id: schema.bottleOptions.id });
    if (updated.length === 0) throw new NotFoundError("Bottle option not found");
    return updated[0];
  }
  const [created] = await db.insert(schema.bottleOptions).values(values).returning({ id: schema.bottleOptions.id });
  return created;
}

export async function setBottleOptionActive(actor: Actor, id: string, isActive: boolean): Promise<CascadeResult> {
  assertAdmin(actor);
  const { result, emailIds } = await getDb().transaction(async (tx) => {
    const updated = await tx.update(schema.bottleOptions).set({ isActive }).where(eq(schema.bottleOptions.id, id)).returning({ id: schema.bottleOptions.id });
    if (updated.length === 0) throw new NotFoundError("Bottle option not found");
    return syncListingAvailability(tx);
  });
  await deliverEmails(emailIds);
  return result;
}

// --- Listing availability cascade --------------------------------------------------------

export type CascadeResult = { paused: number; restored: number };

/**
 * Keeps marketplace listings in step with the catalog: approved listings whose formula or
 * bottle is no longer available become `unavailable`; unavailable ones whose ingredients are
 * all back return to `approved`. Sellers are notified and emailed both ways.
 */
export async function syncListingAvailability(tx: Tx): Promise<{ result: CascadeResult; emailIds: Array<string | null> }> {
  const rows = await tx
    .select({
      listing: schema.marketplaceListings,
      name: schema.savedScents.name,
      formula: schema.savedScents.formula,
      bottle: schema.bottleOptions,
      sellerEmail: schema.users.email,
      sellerName: schema.users.name,
    })
    .from(schema.marketplaceListings)
    .innerJoin(schema.savedScents, eq(schema.savedScents.id, schema.marketplaceListings.savedScentId))
    .innerJoin(schema.bottleOptions, eq(schema.bottleOptions.id, schema.marketplaceListings.bottleOptionId))
    .innerJoin(schema.users, eq(schema.users.id, schema.marketplaceListings.sellerId))
    .where(inArray(schema.marketplaceListings.status, ["approved", "unavailable"]))
    .for("update", { of: schema.marketplaceListings });
  const ingredients = await getIngredientsByIds([...new Set(rows.flatMap((r) => r.formula.map((e) => e.ingredientId)))], tx);

  const emailIds: Array<string | null> = [];
  const result: CascadeResult = { paused: 0, restored: 0 };
  const dashboardUrl = `${env().APP_URL}/account/seller`;

  for (const row of rows) {
    const availability = scentAvailability(row.formula, ingredients, row.bottle);
    const scentName = row.name ?? "Your scent";
    if (row.listing.status === "approved" && !availability.available) {
      const reason = unavailableReason(row.formula, ingredients, row.bottle);
      await tx
        .update(schema.marketplaceListings)
        .set({ status: "unavailable", unavailableReason: reason })
        .where(eq(schema.marketplaceListings.id, row.listing.id));
      await createNotification(tx, {
        userId: row.listing.sellerId,
        type: "listing_unavailable",
        message: `${scentName} is paused: ${reason}`,
        link: "/account/seller",
      });
      emailIds.push(
        await queueEmail(tx, {
          dedupeKey: `listing_unavailable:${row.listing.id}:${Date.now()}`,
          to: row.sellerEmail,
          template: "listing_unavailable",
          payload: { name: row.sellerName, scentName, reason, url: dashboardUrl },
        }),
      );
      result.paused++;
    } else if (row.listing.status === "unavailable" && availability.available) {
      await tx
        .update(schema.marketplaceListings)
        .set({ status: "approved", unavailableReason: null })
        .where(eq(schema.marketplaceListings.id, row.listing.id));
      await createNotification(tx, {
        userId: row.listing.sellerId,
        type: "listing_available",
        message: `${scentName} is back on the marketplace.`,
        link: `/marketplace/${row.listing.id}`,
      });
      emailIds.push(
        await queueEmail(tx, {
          dedupeKey: `listing_available:${row.listing.id}:${Date.now()}`,
          to: row.sellerEmail,
          template: "listing_available",
          payload: { name: row.sellerName, scentName, url: `${env().APP_URL}/marketplace/${row.listing.id}` },
        }),
      );
      result.restored++;
    }
  }
  return { result, emailIds };
}

function unavailableReason(
  formula: Array<{ ingredientId: string; tier: string }>,
  ingredients: Map<string, { name: string; isActive: boolean; noteTier: string }>,
  bottle: { isActive: boolean; sizeLabel: string; format: (typeof BOTTLE_FORMATS)[number] },
): string {
  const missing = formula.map((e) => ingredients.get(e.ingredientId)).filter((i) => i && (!i.isActive)).map((i) => i!.name);
  if (missing.length > 0) return `Ingredient ${missing.join(", ")} was discontinued.`;
  if (!bottle.isActive) return `The ${bottleLabel(bottle)} bottle is no longer offered.`;
  return "An ingredient is no longer available.";
}
