"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { runAction } from "@/server/actions";
import { getActor } from "@/server/auth/session";
import { CACHE_TAGS } from "@/server/cached";
import { resubmitListing, submitListing, withdrawListing, type ListingEdit } from "@/server/dal/marketplace";

export async function submitListingAction(
  input: ListingEdit & { scentId: string },
): Promise<ActionResult<{ id: string; status: "pending_review" | "approved" }>> {
  const result = await runAction(async () => submitListing(await getActor(), input));
  if (result.ok && result.data.status === "approved") updateTag(CACHE_TAGS.marketplace);
  return result;
}

export async function resubmitListingAction(id: string, input: ListingEdit): Promise<ActionResult<{ status: "pending_review" | "approved" }>> {
  const result = await runAction(async () => resubmitListing(await getActor(), z.uuid().parse(id), input));
  if (result.ok && result.data.status === "approved") updateTag(CACHE_TAGS.marketplace);
  return result;
}

export async function withdrawListingAction(id: string): Promise<ActionResult> {
  const result = await runAction(async () => withdrawListing(await getActor(), z.uuid().parse(id)));
  if (result.ok && result.data.wasLive) updateTag(CACHE_TAGS.marketplace);
  return result.ok ? { ok: true, data: undefined } : result;
}
