"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { runAction } from "@/server/actions";
import { getActor } from "@/server/auth/session";
import { CACHE_TAGS } from "@/server/cached";
import { resubmitListing, submitListing, withdrawListing, type ListingEdit } from "@/server/dal/marketplace";

export async function submitListingAction(input: ListingEdit & { scentId: string }): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => submitListing(await getActor(), input));
}

export async function resubmitListingAction(id: string, input: ListingEdit): Promise<ActionResult> {
  return runAction(async () => resubmitListing(await getActor(), z.uuid().parse(id), input));
}

export async function withdrawListingAction(id: string): Promise<ActionResult> {
  const result = await runAction(async () => withdrawListing(await getActor(), z.uuid().parse(id)));
  if (result.ok && result.data.wasLive) updateTag(CACHE_TAGS.marketplace);
  return result.ok ? { ok: true, data: undefined } : result;
}
