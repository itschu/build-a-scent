// Cached public reads for pages ('use cache'). Admin writes invalidate them by tag.
import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { listActiveBottleOptions, listActiveIngredients } from "./dal/catalog";
import { listShippingZones } from "./checkout/shipping";
import { getPublicSettings } from "./settings";

export const CACHE_TAGS = {
  catalog: "catalog",
  settings: "settings",
} as const;

export async function getMixerCatalog() {
  "use cache";
  cacheTag(CACHE_TAGS.catalog, CACHE_TAGS.settings);
  cacheLife("hours");
  const [ingredients, bottleOptions, settings] = await Promise.all([
    listActiveIngredients(),
    listActiveBottleOptions(),
    getPublicSettings(),
  ]);
  return { ingredients, bottleOptions, settings };
}

export async function getCachedPublicSettings() {
  "use cache";
  cacheTag(CACHE_TAGS.settings);
  cacheLife("hours");
  return getPublicSettings();
}

export async function getCachedShippingZones() {
  "use cache";
  cacheTag(CACHE_TAGS.settings);
  cacheLife("hours");
  return listShippingZones();
}

export type MixerCatalog = Awaited<ReturnType<typeof getMixerCatalog>>;
