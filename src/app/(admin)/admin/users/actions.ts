"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { USER_ROLES } from "@/lib/domain";
import { runAction } from "@/server/actions";
import { getActor } from "@/server/auth/session";
import { CACHE_TAGS } from "@/server/cached";
import {
  blockUser,
  deleteUser,
  inviteUser,
  sendPasswordLink,
  setEmailVerified,
  setUserRole,
  signOutEverywhere,
  unblockUser,
  updateUserDetails,
  type InviteUserInput,
  type UserDetailsInput,
} from "@/server/dal/admin-users";

const userId = z.uuid();

// Blocking or deleting hides a seller's listings, so the cached marketplace refreshes too.
async function withMarketplaceRefresh<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  const result = await runAction(fn);
  if (result.ok) updateTag(CACHE_TAGS.marketplace);
  return result;
}

export async function updateUserDetailsAction(id: string, input: UserDetailsInput): Promise<ActionResult> {
  // The display name is the public creator name on listings.
  return withMarketplaceRefresh(async () => updateUserDetails(await getActor(), userId.parse(id), input));
}

export async function setEmailVerifiedAction(id: string, verified: boolean): Promise<ActionResult> {
  return runAction(async () => setEmailVerified(await getActor(), userId.parse(id), z.boolean().parse(verified)));
}

export async function setUserRoleAction(id: string, role: string): Promise<ActionResult> {
  return runAction(async () => setUserRole(await getActor(), userId.parse(id), z.enum(USER_ROLES).parse(role)));
}

export async function blockUserAction(id: string, reason: string): Promise<ActionResult> {
  return withMarketplaceRefresh(async () => blockUser(await getActor(), userId.parse(id), reason));
}

export async function unblockUserAction(id: string): Promise<ActionResult> {
  return withMarketplaceRefresh(async () => unblockUser(await getActor(), userId.parse(id)));
}

export async function signOutEverywhereAction(id: string): Promise<ActionResult> {
  return runAction(async () => signOutEverywhere(await getActor(), userId.parse(id)));
}

export async function sendPasswordLinkAction(id: string): Promise<ActionResult> {
  return runAction(async () => sendPasswordLink(await getActor(), userId.parse(id)));
}

export async function deleteUserAction(id: string): Promise<ActionResult> {
  return withMarketplaceRefresh(async () => deleteUser(await getActor(), userId.parse(id)));
}

export async function inviteUserAction(input: InviteUserInput): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => inviteUser(await getActor(), input));
}
