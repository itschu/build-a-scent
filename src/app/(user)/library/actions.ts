"use server";

import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { runAction } from "@/server/actions";
import { getActor } from "@/server/auth/session";
import { deleteDraft, setSharing } from "@/server/dal/library";

export async function deleteDraftAction(id: string): Promise<ActionResult> {
  return runAction(async () => deleteDraft(await getActor(), z.uuid().parse(id)));
}

export async function setSharingAction(id: string, enabled: boolean): Promise<ActionResult<{ shareToken: string | null }>> {
  return runAction(async () => setSharing(await getActor(), z.uuid().parse(id), z.boolean().parse(enabled)));
}
