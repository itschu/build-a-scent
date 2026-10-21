import "server-only";
import { and, arrayContains, asc, eq } from "drizzle-orm";
import { getDb, schema, type Db, type Tx } from "@/server/db";

export type ShippingQuote = { zoneId: string; zoneName: string; feeKobo: number; etaMinDays: number; etaMaxDays: number };

export async function quoteShipping(state: string, executor: Db | Tx = getDb()): Promise<ShippingQuote | null> {
  const [zone] = await executor
    .select()
    .from(schema.shippingZones)
    .where(and(eq(schema.shippingZones.isActive, true), arrayContains(schema.shippingZones.states, [state])))
    .orderBy(asc(schema.shippingZones.feeKobo))
    .limit(1);
  if (!zone) return null;
  return { zoneId: zone.id, zoneName: zone.name, feeKobo: zone.feeKobo, etaMinDays: zone.etaMinDays, etaMaxDays: zone.etaMaxDays };
}

/** Public read for the checkout form: each state's fee and delivery estimate. */
export async function listShippingZones() {
  return getDb()
    .select({
      id: schema.shippingZones.id,
      name: schema.shippingZones.name,
      states: schema.shippingZones.states,
      feeKobo: schema.shippingZones.feeKobo,
      etaMinDays: schema.shippingZones.etaMinDays,
      etaMaxDays: schema.shippingZones.etaMaxDays,
    })
    .from(schema.shippingZones)
    .where(eq(schema.shippingZones.isActive, true))
    .orderBy(asc(schema.shippingZones.feeKobo));
}
