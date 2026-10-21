// Cached public reads for pages ('use cache'). Admin writes invalidate them by tag.
import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { listActiveBottleOptions, listActiveIngredients } from "./dal/catalog";
import { listMarketplace } from "./dal/marketplace";
import { listShopProducts } from "./dal/products";
import { listShippingZones } from "./checkout/shipping";
import { getPublicSettings } from "./settings";

export const CACHE_TAGS = {
  catalog: "catalog",
  settings: "settings",
  products: "products",
  marketplace: "marketplace",
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

export async function getCachedMarketplace() {
  "use cache";
  // Buyer prices depend on ingredient prices and commission, so those changes refresh it too.
  cacheTag(CACHE_TAGS.marketplace, CACHE_TAGS.catalog, CACHE_TAGS.settings);
  cacheLife("hours");
  return listMarketplace();
}

export type MixerCatalog = Awaited<ReturnType<typeof getMixerCatalog>>;
