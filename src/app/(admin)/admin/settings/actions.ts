"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { runAction } from "@/server/actions";
import { getActor, getSessionUser } from "@/server/auth/session";
import { retryUndeliverableEmail, sendTestEmail } from "@/server/dal/admin-email";
import { CACHE_TAGS } from "@/server/cached";
import { saveShippingZone, setShippingZoneActive, updateSettings, type ShippingZoneInput } from "@/server/dal/admin-settings";

// Settings drive prices (tier shares, commission), so the marketplace and mixer refresh too.
async function withSettingsRefresh<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  const result = await runAction(fn);
  if (result.ok) updateTag(CACHE_TAGS.settings);
  return result;
}

export async function updateSettingsAction(values: Record<string, unknown>) {
  return withSettingsRefresh(async () => updateSettings(await getActor(), values));
}

export async function saveShippingZoneAction(input: ShippingZoneInput & { id?: string }) {
  return withSettingsRefresh(async () => saveShippingZone(await getActor(), input));
}

export async function setShippingZoneActiveAction(id: string, isActive: boolean) {
  return withSettingsRefresh(async () => setShippingZoneActive(await getActor(), z.uuid().parse(id), isActive));
}

export async function sendTestEmailAction(): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await getActor();
    const user = await getSessionUser();
    if (!user) throw new Error("Not signed in");
    await sendTestEmail(actor, user.email);
  });
}

export async function retryEmailAction(id: string): Promise<ActionResult<"sent" | "failed" | "skipped">> {
  return runAction(async () => retryUndeliverableEmail(await getActor(), z.uuid().parse(id)));
}
