import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  integer,
  jsonb,
  pgTable,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { BOTTLE_FORMATS, NOTE_TIERS, type BottleFormat, type NoteTier } from "@/lib/domain";
import { id, oneOf, timestamps } from "./_helpers";

export const ingredients = pgTable(
  "ingredients",
  {
    id: id(),
    name: text().notNull().unique(),
    noteTier: text().$type<NoteTier>().notNull(),
    scentFamily: text().notNull(),
    colorHex: text().notNull(),
    // Retail price per ml of pure ingredient (already includes margin).
    pricePerMlKobo: bigint({ mode: "number" }).notNull(),
    imageUrl: text(),
    isActive: boolean().notNull().default(true),
    ...timestamps,
  },
  (t) => [
    check("ingredients_note_tier_check", oneOf(t.noteTier, NOTE_TIERS)),
    check("ingredients_color_hex_check", sql`${t.colorHex} ~ '^#[0-9a-fA-F]{6}$'`),
    check("ingredients_price_check", sql`${t.pricePerMlKobo} >= 0`),
  ],
);

export const bottleOptions = pgTable(
  "bottle_options",
  {
    id: id(),
    sizeLabel: text().notNull(),
    volumeMl: integer().notNull(),
    format: text().$type<BottleFormat>().notNull(),
    // Share of the bottle that is fragrance concentrate (spray 20, roll-on 25, oil 100).
    concentrationPct: integer().notNull(),
    basePriceKobo: bigint({ mode: "number" }).notNull(),
    isActive: boolean().notNull().default(true),
    sortOrder: integer().notNull().default(0),
    ...timestamps,
  },
  (t) => [
    unique("bottle_options_volume_format_unique").on(t.volumeMl, t.format),
    check("bottle_options_format_check", oneOf(t.format, BOTTLE_FORMATS)),
    check("bottle_options_volume_check", sql`${t.volumeMl} > 0`),
    check(
      "bottle_options_concentration_check",
      sql`${t.concentrationPct} between 1 and 100`,
    ),
    check("bottle_options_price_check", sql`${t.basePriceKobo} >= 0`),
  ],
);

export type ProductNotes = { base: string[]; heart: string[]; top: string[] };

export const products = pgTable("products", {
  id: id(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  description: text().notNull().default(""),
  scentFamily: text().notNull(),
  notes: jsonb().$type<ProductNotes>().notNull().default({ base: [], heart: [], top: [] }),
  images: jsonb().$type<string[]>().notNull().default([]),
  isActive: boolean().notNull().default(true),
  ...timestamps,
});

export const productVariants = pgTable(
  "product_variants",
  {
    id: id(),
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sizeLabel: text().notNull(),
    format: text().$type<BottleFormat>().notNull(),
    priceKobo: bigint({ mode: "number" }).notNull(),
    stockQty: integer().notNull().default(0),
    isActive: boolean().notNull().default(true),
    ...timestamps,
  },
  (t) => [
    check("product_variants_format_check", oneOf(t.format, BOTTLE_FORMATS)),
    check("product_variants_price_check", sql`${t.priceKobo} >= 0`),
    check("product_variants_stock_check", sql`${t.stockQty} >= 0`),
  ],
);

export const shippingZones = pgTable(
  "shipping_zones",
  {
    id: id(),
    name: text().notNull().unique(),
    states: text().array().notNull(),
    feeKobo: bigint({ mode: "number" }).notNull(),
    etaMinDays: integer().notNull(),
    etaMaxDays: integer().notNull(),
    isActive: boolean().notNull().default(true),
    ...timestamps,
  },
  (t) => [
    check("shipping_zones_fee_check", sql`${t.feeKobo} >= 0`),
    check(
      "shipping_zones_eta_check",
      sql`${t.etaMinDays} >= 0 and ${t.etaMinDays} <= ${t.etaMaxDays}`,
    ),
  ],
);
