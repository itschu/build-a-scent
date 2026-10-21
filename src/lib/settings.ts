// Registry of platform settings: type, default, and whether the value may be sent to browsers.
import { z } from "zod";

const percent = z.number().min(0).max(100);
const wholePercent = z.number().int().min(0).max(100);
const nonNegativeInt = z.number().int().min(0);
const positiveInt = z.number().int().positive();

export const SETTINGS = {
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
