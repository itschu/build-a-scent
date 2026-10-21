"use server";

import type { ActionResult } from "@/lib/action-result";
import type { SaveDraftInput, SaveScentInput } from "@/lib/validation/scent";
import { runAction } from "@/server/actions";
import { getActor } from "@/server/auth/session";
import { saveDraft, saveScent } from "@/server/dal/scents";

export async function saveDraftAction(input: SaveDraftInput): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => saveDraft(await getActor(), input));
}

export async function saveScentAction(input: SaveScentInput): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => saveScent(await getActor(), input));
}
