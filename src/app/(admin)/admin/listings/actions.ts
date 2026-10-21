"use server";

import { updateTag } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { runAction } from "@/server/actions";
import { getActor } from "@/server/auth/session";
import { CACHE_TAGS } from "@/server/cached";
import { approveListing, rejectListing } from "@/server/dal/moderation";

export async function approveListingAction(id: string): Promise<ActionResult> {
  const result = await runAction(async () => approveListing(await getActor(), id));
  // The listing goes live immediately (Flow 6).
  if (result.ok) updateTag(CACHE_TAGS.marketplace);
  return result;
}

export async function rejectListingAction(id: string, reason: string): Promise<ActionResult> {
  return runAction(async () => rejectListing(await getActor(), id, reason));
}
