// Cached public reads for pages ('use cache'). Admin writes invalidate them by tag.
import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { listActiveBottleOptions, listActiveIngredients } from "./dal/catalog";
import { listShopProducts } from "./dal/products";
import { listShippingZones } from "./checkout/shipping";
import { getPublicSettings } from "./settings";

export const CACHE_TAGS = {
  catalog: "catalog",
  settings: "settings",
  products: "products",
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

export async function getCachedShopProducts() {
  "use cache";
  cacheTag(CACHE_TAGS.products);
  cacheLife("hours");
  return listShopProducts();
}

export type MixerCatalog = Awaited<ReturnType<typeof getMixerCatalog>>;
