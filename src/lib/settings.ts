// Registry of platform settings: type, default, and whether the value may be sent to browsers.
import { z } from "zod";

const percent = z.number().min(0).max(100);
const wholePercent = z.number().int().min(0).max(100);
const nonNegativeInt = z.number().int().min(0);
const positiveInt = z.number().int().positive();
const text = (max: number) => z.string().trim().max(max);

/** What counts toward the orders a seller needs before listing a scent. */
export const LISTING_ORDER_SCOPES = ["same_scent", "any"] as const;
export type ListingOrderScope = (typeof LISTING_ORDER_SCOPES)[number];

/** Hard ceiling for the per-item quantity setting (and the cart's own limit). */
export const MAX_LINE_QUANTITY_LIMIT = 50;

export const SETTINGS = {
  // Store switches.
  checkout_enabled: { schema: z.boolean(), default: true, isPublic: true },
  checkout_paused_message: { schema: text(200), default: "", isPublic: true },
  listings_enabled: { schema: z.boolean(), default: true, isPublic: true },
  signups_enabled: { schema: z.boolean(), default: true, isPublic: true },
  // Selling rules. 0 means "no requirement" / "no limit".
  listing_auto_approve: { schema: z.boolean(), default: false, isPublic: false },
  max_active_listings_per_seller: { schema: nonNegativeInt, default: 0, isPublic: true },
  listing_required_orders: { schema: nonNegativeInt.max(100), default: 0, isPublic: true },
  listing_order_scope: { schema: z.enum(LISTING_ORDER_SCOPES), default: "same_scent" as ListingOrderScope, isPublic: true },
  // Order rules. 0 turns the threshold or minimum off.
  free_shipping_threshold_kobo: { schema: nonNegativeInt, default: 0, isPublic: true },
  min_order_kobo: { schema: nonNegativeInt, default: 0, isPublic: true },
  max_line_quantity: { schema: positiveInt.max(MAX_LINE_QUANTITY_LIMIT), default: 10, isPublic: true },
  // Storefront content. Empty hides it.
  announcement_text: { schema: text(200), default: "", isPublic: true },
  support_email: { schema: z.union([z.literal(""), z.email()]), default: "", isPublic: true },
  support_phone: { schema: text(30), default: "", isPublic: true },

  commission_pct: { schema: percent, default: 20, isPublic: true },
  usd_exchange_rate: { schema: z.number().positive(), default: 1600, isPublic: true },
  min_creator_markup_kobo: { schema: nonNegativeInt, default: 100_000, isPublic: true },
  tier_share_base: { schema: wholePercent, default: 40, isPublic: true },
  tier_share_heart: { schema: wholePercent, default: 35, isPublic: true },
  tier_share_top: { schema: wholePercent, default: 25, isPublic: true },
  production_lead_days: { schema: nonNegativeInt, default: 3, isPublic: true },
  low_stock_reserve_threshold: { schema: nonNegativeInt, default: 5, isPublic: false },
  reservation_ttl_minutes: { schema: positiveInt, default: 30, isPublic: false },
  payment_window_minutes: { schema: positiveInt, default: 60, isPublic: false },
} as const;

export type SettingKey = keyof typeof SETTINGS;
export type SettingValues = { [K in SettingKey]: z.infer<(typeof SETTINGS)[K]["schema"]> };

export type PublicSettingKey = {
  [K in SettingKey]: (typeof SETTINGS)[K]["isPublic"] extends true ? K : never;
}[SettingKey];
export type PublicSettings = Pick<SettingValues, PublicSettingKey>;

export const SETTING_KEYS = Object.keys(SETTINGS) as SettingKey[];
export const PUBLIC_SETTING_KEYS = SETTING_KEYS.filter(
  (k) => SETTINGS[k].isPublic,
) as PublicSettingKey[];

export function defaultSettings(): SettingValues {
  return Object.fromEntries(SETTING_KEYS.map((k) => [k, SETTINGS[k].default])) as SettingValues;
}

/**
 * Builds typed settings from stored rows. Missing or invalid values fall back to defaults,
 * so a bad row can never take checkout down.
 */
export function parseSettings(rows: ReadonlyArray<{ key: string; value: unknown }>): SettingValues {
  const values = defaultSettings() as Record<SettingKey, unknown>;
  for (const row of rows) {
    if (!(row.key in SETTINGS)) continue;
    const key = row.key as SettingKey;
    const parsed = SETTINGS[key].schema.safeParse(row.value);
    if (parsed.success) values[key] = parsed.data;
  }
  return values as SettingValues;
}

export function tierSharesFrom(settings: Pick<
  SettingValues,
  "tier_share_base" | "tier_share_heart" | "tier_share_top"
>) {
  return {
    base: settings.tier_share_base,
    heart: settings.tier_share_heart,
    top: settings.tier_share_top,
  };
}
