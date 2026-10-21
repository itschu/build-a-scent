"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { ORDER_STATUSES } from "@/lib/domain";
import { runAction } from "@/server/actions";
import { getActor } from "@/server/auth/session";
import { CACHE_TAGS } from "@/server/cached";
import { advanceFulfilment, cancelOrder, recordRefund, resolveAttention, reverifyOrder } from "@/server/dal/admin-orders";
import type { ApplyOutcome } from "@/server/payments/apply";

export async function reverifyOrderAction(id: string): Promise<ActionResult<ApplyOutcome>> {
  return runAction(async () => reverifyOrder(await getActor(), z.uuid().parse(id)));
}

export async function advanceFulfilmentAction(id: string, to: string): Promise<ActionResult> {
  return runAction(async () => advanceFulfilment(await getActor(), z.uuid().parse(id), z.enum(ORDER_STATUSES).parse(to)));
}

export async function cancelOrderAction(id: string): Promise<ActionResult> {
  return runAction(async () => cancelOrder(await getActor(), z.uuid().parse(id)));
}

export async function recordRefundAction(id: string, input: { reason: string; restock: boolean }): Promise<ActionResult> {
  const result = await runAction(async () => recordRefund(await getActor(), z.uuid().parse(id), input));
  // Restocking changes shop availability.
  if (result.ok && input.restock) updateTag(CACHE_TAGS.products);
  return result;
}

export async function resolveAttentionAction(id: string, note: string): Promise<ActionResult> {
  return runAction(async () => resolveAttention(await getActor(), z.uuid().parse(id), note));
}
