"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import type { ProductInput, VariantInput } from "@/lib/validation/product";
import { runAction } from "@/server/actions";
import { getActor } from "@/server/auth/session";
import { CACHE_TAGS } from "@/server/cached";
import { saveProduct, saveVariant, setProductActive, setVariantActive } from "@/server/dal/products";

// Every change refreshes the cached shop immediately (read-your-own-writes).
async function withShopRefresh<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  const result = await runAction(fn);
  if (result.ok) updateTag(CACHE_TAGS.products);
  return result;
}

export async function saveProductAction(input: ProductInput & { id?: string }) {
  return withShopRefresh(async () => saveProduct(await getActor(), input));
}

export async function setProductActiveAction(id: string, isActive: boolean) {
  return withShopRefresh(async () => setProductActive(await getActor(), z.uuid().parse(id), isActive));
}

export async function saveVariantAction(input: VariantInput & { productId: string; id?: string }) {
  return withShopRefresh(async () => saveVariant(await getActor(), input));
}

export async function setVariantActiveAction(id: string, isActive: boolean) {
  return withShopRefresh(async () => setVariantActive(await getActor(), z.uuid().parse(id), isActive));
}
