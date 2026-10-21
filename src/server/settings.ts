import "server-only";
import { inArray } from "drizzle-orm";
import {
  parseSettings,
  PUBLIC_SETTING_KEYS,
  type PublicSettings,
  type SettingValues,
} from "@/lib/settings";
import { getDb, schema } from "./db";
import { assertAdmin, type Actor } from "./dal/actor";

/** All settings, for server-side business logic (checkout, pricing, jobs). */
export async function getSettings(): Promise<SettingValues> {
  const rows = await getDb()
    .select({ key: schema.platformSettings.key, value: schema.platformSettings.value })
    .from(schema.platformSettings);
  return parseSettings(rows);
}

/** Only the keys flagged public; safe to send to browsers. */
export async function getPublicSettings(): Promise<PublicSettings> {
  const rows = await getDb()
    .select({ key: schema.platformSettings.key, value: schema.platformSettings.value })
    .from(schema.platformSettings)
    .where(inArray(schema.platformSettings.key, PUBLIC_SETTING_KEYS));
  const all = parseSettings(rows);
  return Object.fromEntries(PUBLIC_SETTING_KEYS.map((k) => [k, all[k]])) as PublicSettings;
}

/** Admin view of every setting, including private ones. */
export async function getSettingsForAdmin(actor: Actor): Promise<SettingValues> {
  assertAdmin(actor);
  return getSettings();
}
