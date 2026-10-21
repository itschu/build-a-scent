"use server";

import { z } from "zod";
import { getActor } from "@/server/auth/session";
import { markNotificationsRead } from "@/server/dal/notifications";

export async function markNotificationsReadAction(ids: string[]) {
  const actor = await getActor();
  if (actor.kind !== "user") return;
  await markNotificationsRead(actor, z.array(z.uuid()).max(100).parse(ids));
}
