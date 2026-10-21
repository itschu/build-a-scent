"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { runAction } from "@/server/actions";
import { getActor } from "@/server/auth/session";
import { CACHE_TAGS } from "@/server/cached";
import {
  deleteIngredient,
  saveBottleOption,
  saveIngredient,
  setBottleOptionActive,
  setIngredientActive,
  type BottleOptionInput,
  type CascadeResult,
  type IngredientInput,
} from "@/server/dal/admin-catalog";

// Catalog changes refresh the mixer and the marketplace (whose prices depend on it).
async function withCatalogRefresh<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  const result = await runAction(fn);
  if (result.ok) updateTag(CACHE_TAGS.catalog);
  return result;
}

export async function saveIngredientAction(input: IngredientInput & { id?: string }) {
  return withCatalogRefresh(async () => saveIngredient(await getActor(), input));
}

export async function setIngredientActiveAction(id: string, isActive: boolean): Promise<ActionResult<CascadeResult>> {
  return withCatalogRefresh(async () => setIngredientActive(await getActor(), z.uuid().parse(id), isActive));
}

export async function deleteIngredientAction(id: string) {
  return withCatalogRefresh(async () => deleteIngredient(await getActor(), z.uuid().parse(id)));
}

export async function saveBottleOptionAction(input: BottleOptionInput & { id?: string }) {
  return withCatalogRefresh(async () => saveBottleOption(await getActor(), input));
}

export async function setBottleOptionActiveAction(id: string, isActive: boolean): Promise<ActionResult<CascadeResult>> {
  return withCatalogRefresh(async () => setBottleOptionActive(await getActor(), z.uuid().parse(id), isActive));
}
