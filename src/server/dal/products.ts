import "server-only";
import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import type { BottleFormat } from "@/lib/domain";
import { productInputSchema, variantInputSchema, type ProductInput, type VariantInput } from "@/lib/validation/product";
import { getDb, schema } from "@/server/db";
import type { ProductNotes } from "@/server/db/schema";
import { assertAdmin, NotFoundError, ValidationError, type Actor } from "./actor";

export type ShopProductCard = {
  id: string;
  slug: string;
  name: string;
  scentFamily: string;
  imageUrl: string | null;
  minPriceKobo: number;
  maxPriceKobo: number;
  formats: BottleFormat[];
  inStock: boolean;
};

/** Public read: active products that have at least one active variant. */
export async function listShopProducts(): Promise<ShopProductCard[]> {
  const db = getDb();
  const rows = await db
    .select({ product: schema.products, variant: schema.productVariants })
    .from(schema.products)
    .innerJoin(schema.productVariants, eq(schema.productVariants.productId, schema.products.id))
    .where(and(eq(schema.products.isActive, true), eq(schema.productVariants.isActive, true)))
    .orderBy(asc(schema.products.name));

  const cards = new Map<string, ShopProductCard>();
  for (const { product, variant } of rows) {
    const card = cards.get(product.id) ?? {
      id: product.id,
      slug: product.slug,
      name: product.name,
      scentFamily: product.scentFamily,
      imageUrl: product.images[0] ?? null,
      minPriceKobo: variant.priceKobo,
      maxPriceKobo: variant.priceKobo,
      formats: [],
      inStock: false,
    };
    card.minPriceKobo = Math.min(card.minPriceKobo, variant.priceKobo);
    card.maxPriceKobo = Math.max(card.maxPriceKobo, variant.priceKobo);
    if (!card.formats.includes(variant.format)) card.formats.push(variant.format);
    card.inStock ||= variant.stockQty > 0;
    cards.set(product.id, card);
  }
  return [...cards.values()];
}

export type ShopVariant = {
  id: string;
  sizeLabel: string;
  format: BottleFormat;
  priceKobo: number;
  /** Stock minus active checkout holds. */
  available: number;
};

export type ShopProduct = {
  id: string;
  slug: string;
  name: string;
  description: string;
  scentFamily: string;
  notes: ProductNotes;
  images: string[];
  variants: ShopVariant[];
};

/** Public read of one active product with its active variants and live availability. */
export async function getShopProduct(slug: string): Promise<ShopProduct | null> {
  const db = getDb();
  const [product] = await db
    .select()
    .from(schema.products)
    .where(and(eq(schema.products.slug, slug), eq(schema.products.isActive, true)));
  if (!product) return null;
  const variants = await db
    .select()
    .from(schema.productVariants)
    .where(and(eq(schema.productVariants.productId, product.id), eq(schema.productVariants.isActive, true)))
    .orderBy(asc(schema.productVariants.priceKobo));
  if (variants.length === 0) return null;
  const held = await db
    .select({
      variantId: schema.inventoryReservations.productVariantId,
      quantity: sql<number>`coalesce(sum(${schema.inventoryReservations.quantity}), 0)::int`,
    })
    .from(schema.inventoryReservations)
    .where(
      and(
        inArray(schema.inventoryReservations.productVariantId, variants.map((v) => v.id)),
        eq(schema.inventoryReservations.status, "active"),
        gt(schema.inventoryReservations.expiresAt, new Date()),
      ),
    )
    .groupBy(schema.inventoryReservations.productVariantId);
  const heldBy = new Map(held.map((h) => [h.variantId, h.quantity]));
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    scentFamily: product.scentFamily,
    notes: product.notes,
    images: product.images,
    variants: variants.map((v) => ({
      id: v.id,
      sizeLabel: v.sizeLabel,
      format: v.format,
      priceKobo: v.priceKobo,
      available: Math.max(0, v.stockQty - (heldBy.get(v.id) ?? 0)),
    })),
  };
}

// --- Admin -----------------------------------------------------------------------------

export type AdminVariant = typeof schema.productVariants.$inferSelect;
export type AdminProduct = typeof schema.products.$inferSelect & { variants: AdminVariant[] };

export async function listProductsForAdmin(actor: Actor): Promise<AdminProduct[]> {
  assertAdmin(actor);
  const db = getDb();
  const [products, variants] = await Promise.all([
    db.select().from(schema.products).orderBy(asc(schema.products.name)),
    db.select().from(schema.productVariants).orderBy(asc(schema.productVariants.priceKobo)),
  ]);
  return products.map((p) => ({ ...p, variants: variants.filter((v) => v.productId === p.id) }));
}

export async function getProductForAdmin(actor: Actor, id: string): Promise<AdminProduct> {
  assertAdmin(actor);
  const db = getDb();
  const [product] = await db.select().from(schema.products).where(eq(schema.products.id, id));
  if (!product) throw new NotFoundError("Product not found");
  const variants = await db
    .select()
    .from(schema.productVariants)
    .where(eq(schema.productVariants.productId, id))
    .orderBy(asc(schema.productVariants.priceKobo));
  return { ...product, variants };
}

async function assertSlugFree(slug: string, exceptId?: string) {
  const [taken] = await getDb().select({ id: schema.products.id }).from(schema.products).where(eq(schema.products.slug, slug));
  if (taken && taken.id !== exceptId) throw new ValidationError("Another product already uses that URL slug.");
}

/** Creates a product (id omitted) or updates one. New products start hidden until they have variants. */
export async function saveProduct(actor: Actor, input: ProductInput & { id?: string }): Promise<{ id: string }> {
  assertAdmin(actor);
  const data = productInputSchema.parse(input);
  await assertSlugFree(data.slug, input.id);
  const db = getDb();
  if (input.id) {
    const updated = await db.update(schema.products).set(data).where(eq(schema.products.id, input.id)).returning({ id: schema.products.id });
    if (updated.length === 0) throw new NotFoundError("Product not found");
    return updated[0];
  }
  const [created] = await db.insert(schema.products).values({ ...data, isActive: false }).returning({ id: schema.products.id });
  return created;
}

export async function setProductActive(actor: Actor, id: string, isActive: boolean) {
  assertAdmin(actor);
  const updated = await getDb().update(schema.products).set({ isActive }).where(eq(schema.products.id, id)).returning({ id: schema.products.id });
  if (updated.length === 0) throw new NotFoundError("Product not found");
}

export async function saveVariant(
  actor: Actor,
  input: VariantInput & { productId: string; id?: string },
): Promise<{ id: string }> {
  assertAdmin(actor);
  const data = variantInputSchema.parse(input);
  const db = getDb();
  if (input.id) {
    const updated = await db
      .update(schema.productVariants)
      .set(data)
      .where(and(eq(schema.productVariants.id, input.id), eq(schema.productVariants.productId, input.productId)))
      .returning({ id: schema.productVariants.id });
    if (updated.length === 0) throw new NotFoundError("Variant not found");
    return updated[0];
  }
  const [product] = await db.select({ id: schema.products.id }).from(schema.products).where(eq(schema.products.id, input.productId));
  if (!product) throw new NotFoundError("Product not found");
  const [created] = await db
    .insert(schema.productVariants)
    .values({ ...data, productId: input.productId })
    .returning({ id: schema.productVariants.id });
  return created;
}

export async function setVariantActive(actor: Actor, id: string, isActive: boolean) {
  assertAdmin(actor);
  const updated = await getDb()
    .update(schema.productVariants)
    .set({ isActive })
    .where(eq(schema.productVariants.id, id))
    .returning({ id: schema.productVariants.id });
  if (updated.length === 0) throw new NotFoundError("Variant not found");
}
