import { sql } from "drizzle-orm";
import type { BottleFormat, NoteTier } from "../src/lib/domain";
import { NIGERIAN_STATES } from "../src/lib/nigeria";
import { SETTING_KEYS, SETTINGS } from "../src/lib/settings";
import * as schema from "../src/server/db/schema";
import type { ScriptDb } from "./db";

const naira = (n: number) => n * 100;

const BOTTLE_OPTIONS: Array<{
  volumeMl: number;
  format: BottleFormat;
  concentrationPct: number;
  basePriceKobo: number;
}> = [
  { volumeMl: 10, format: "spray", concentrationPct: 20, basePriceKobo: naira(6_000) },
  { volumeMl: 30, format: "spray", concentrationPct: 20, basePriceKobo: naira(10_000) },
  { volumeMl: 50, format: "spray", concentrationPct: 20, basePriceKobo: naira(15_000) },
  { volumeMl: 100, format: "spray", concentrationPct: 20, basePriceKobo: naira(24_000) },
  { volumeMl: 10, format: "roll_on", concentrationPct: 25, basePriceKobo: naira(5_000) },
  { volumeMl: 30, format: "roll_on", concentrationPct: 25, basePriceKobo: naira(8_500) },
  { volumeMl: 10, format: "oil", concentrationPct: 100, basePriceKobo: naira(5_500) },
  { volumeMl: 30, format: "oil", concentrationPct: 100, basePriceKobo: naira(9_500) },
];

const LAGOS = ["Lagos"];

const SHIPPING_ZONES = [
  { name: "Lagos", states: LAGOS, feeKobo: naira(3_000), etaMinDays: 2, etaMaxDays: 4 },
  {
    name: "Rest of Nigeria",
    states: NIGERIAN_STATES.filter((s) => !LAGOS.includes(s)),
    feeKobo: naira(5_500),
    etaMinDays: 4,
    etaMaxDays: 7,
  },
];

// Starter ingredient catalogue (also loaded in production with --ingredients); prices are
// per ml of pure ingredient and editable in the admin panel.
const SAMPLE_INGREDIENTS: Array<[string, NoteTier, string, string, number]> = [
  ["Sandalwood", "base", "Woody", "#8b5a2b", 800],
  ["Musk", "base", "Musky", "#d8c8b8", 600],
  ["Amber", "base", "Ambery", "#c98a2b", 700],
  ["Cedarwood", "base", "Woody", "#a0522d", 500],
  ["Vanilla", "base", "Gourmand", "#f3e5ab", 650],
  ["Oud", "base", "Woody", "#3b2414", 2_500],
  ["Rose", "heart", "Floral", "#c06080", 1_200],
  ["Jasmine", "heart", "Floral", "#e8d870", 1_000],
  ["Iris", "heart", "Powdery", "#7b68c8", 1_500],
  ["Ylang Ylang", "heart", "Exotic", "#d4a843", 900],
  ["Geranium", "heart", "Green", "#7ab648", 600],
  ["Peony", "heart", "Floral", "#e8a0b0", 800],
  ["Bergamot", "top", "Citrus", "#c5d86d", 400],
  ["Lemon", "top", "Citrus", "#f4e04d", 300],
  ["Mint", "top", "Fresh", "#7fd1ae", 300],
  ["Pink Pepper", "top", "Spicy", "#d4626b", 550],
  ["Grapefruit", "top", "Citrus", "#f28b6b", 350],
  ["Lavender", "top", "Aromatic", "#a68fd8", 450],
];

// Development shop catalogue (no images: the shop shows a bottle illustration instead).
const SAMPLE_PRODUCTS = [
  {
    slug: "noir-classic",
    name: "Noir Classic",
    scentFamily: "Woody",
    description: "Smoked oud and amber warmed with a whisper of pink pepper. Our signature evening scent.",
    notes: { base: ["Oud", "Amber"], heart: ["Iris"], top: ["Pink Pepper"] },
    variants: [
      { sizeLabel: "50ml", format: "spray" as const, priceKobo: naira(28_000), stockQty: 24 },
      { sizeLabel: "100ml", format: "spray" as const, priceKobo: naira(45_000), stockQty: 3 },
    ],
  },
  {
    slug: "lagos-bloom",
    name: "Lagos Bloom",
    scentFamily: "Floral",
    description: "Jasmine and rose over soft musk, bright with bergamot.",
    notes: { base: ["Musk"], heart: ["Jasmine", "Rose"], top: ["Bergamot"] },
    variants: [
      { sizeLabel: "30ml", format: "spray" as const, priceKobo: naira(16_500), stockQty: 40 },
      { sizeLabel: "10ml", format: "roll_on" as const, priceKobo: naira(7_500), stockQty: 0 },
    ],
  },
  {
    slug: "citrus-harmattan",
    name: "Citrus Harmattan",
    scentFamily: "Citrus",
    description: "Grapefruit and lemon over cedarwood: a crisp, dry-season pick-me-up.",
    notes: { base: ["Cedarwood"], heart: ["Geranium"], top: ["Grapefruit", "Lemon"] },
    variants: [{ sizeLabel: "10ml", format: "oil" as const, priceKobo: naira(9_000), stockQty: 15 }],
  },
];

/**
 * Idempotent seed. Existing rows are never overwritten, so it is safe to re-run against a
 * database an admin has already edited (only each setting's public flag is kept in sync).
 */
export async function seed(db: ScriptDb, options: { sampleData: boolean; ingredients?: boolean }) {
  await db
    .insert(schema.platformSettings)
    .values(
      SETTING_KEYS.map((key) => ({
        key,
        value: SETTINGS[key].default,
        isPublic: SETTINGS[key].isPublic,
      })),
    )
    .onConflictDoUpdate({
      target: schema.platformSettings.key,
      set: { isPublic: sql`excluded.is_public` },
    });

  await db
    .insert(schema.bottleOptions)
    .values(
      BOTTLE_OPTIONS.map((o, i) => ({ ...o, sizeLabel: `${o.volumeMl}ml`, sortOrder: i })),
    )
    .onConflictDoNothing();

  await db.insert(schema.shippingZones).values(SHIPPING_ZONES).onConflictDoNothing();

  if (options.sampleData || options.ingredients) {
    await db
      .insert(schema.ingredients)
      .values(
        SAMPLE_INGREDIENTS.map(([name, noteTier, scentFamily, colorHex, pricePerMl]) => ({
          name,
          noteTier,
          scentFamily,
          colorHex,
          pricePerMlKobo: naira(pricePerMl),
        })),
      )
      .onConflictDoNothing();
  }

  if (options.sampleData) {
    for (const { variants, ...product } of SAMPLE_PRODUCTS) {
      const [created] = await db.insert(schema.products).values(product).onConflictDoNothing().returning({ id: schema.products.id });
      if (created) await db.insert(schema.productVariants).values(variants.map((v) => ({ ...v, productId: created.id })));
    }
  }
}
