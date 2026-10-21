import "server-only";
import { and, asc, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { NIGERIAN_STATES } from "@/lib/nigeria";
import { SETTING_KEYS, SETTINGS, type SettingValues } from "@/lib/settings";
import { getDb, schema } from "@/server/db";
import { getSettings } from "@/server/settings";
import { assertAdmin, NotFoundError, ValidationError, type Actor } from "./actor";

export async function getSettingsForAdmin(actor: Actor): Promise<SettingValues> {
  assertAdmin(actor);
  return getSettings();
}

/** Validates every value against the settings registry; tier shares must sum to 100. */
export async function updateSettings(actor: Actor, input: Partial<Record<string, unknown>>): Promise<void> {
  assertAdmin(actor);
  const current = await getSettings();
  const next = { ...current } as Record<string, unknown>;
  for (const key of SETTING_KEYS) {
    if (!(key in input)) continue;
    const parsed = SETTINGS[key].schema.safeParse(input[key]);
    if (!parsed.success) throw new ValidationError(`${key.replaceAll("_", " ")}: ${parsed.error.issues[0].message}`);
    next[key] = parsed.data;
  }
  const values = next as SettingValues;
  if (values.tier_share_base + values.tier_share_heart + values.tier_share_top !== 100) {
    throw new ValidationError("Base, heart and top shares must add up to 100%.");
  }
  await getDb().transaction(async (tx) => {
    for (const key of SETTING_KEYS) {
      await tx
        .insert(schema.platformSettings)
        .values({ key, value: values[key], isPublic: SETTINGS[key].isPublic })
        .onConflictDoUpdate({ target: schema.platformSettings.key, set: { value: values[key] } });
    }
  });
}

export const shippingZoneInputSchema = z
  .object({
    name: z.string().trim().min(2, "Name is required").max(60),
    states: z.array(z.enum(NIGERIAN_STATES)).min(1, "Choose at least one state"),
    feeKobo: z.number().int().min(0),
    etaMinDays: z.number().int().min(0).max(60),
    etaMaxDays: z.number().int().min(0).max(60),
  })
  .refine((z) => z.etaMinDays <= z.etaMaxDays, "The earliest delivery day can't be after the latest");
export type ShippingZoneInput = z.input<typeof shippingZoneInputSchema>;

export async function listShippingZonesForAdmin(actor: Actor) {
  assertAdmin(actor);
  return getDb().select().from(schema.shippingZones).orderBy(asc(schema.shippingZones.name));
}

/** A state may belong to only one active zone, so every address has exactly one fee. */
async function assertNoOverlap(states: string[], exceptId?: string) {
  const others = await getDb()
    .select()
    .from(schema.shippingZones)
    .where(and(eq(schema.shippingZones.isActive, true), exceptId ? ne(schema.shippingZones.id, exceptId) : undefined));
  for (const zone of others) {
    const overlap = zone.states.filter((s) => states.includes(s));
    if (overlap.length) throw new ValidationError(`${overlap.join(", ")} already ${overlap.length === 1 ? "belongs" : "belong"} to ${zone.name}.`);
  }
}

export async function saveShippingZone(actor: Actor, input: ShippingZoneInput & { id?: string }): Promise<{ id: string }> {
  assertAdmin(actor);
  const data = shippingZoneInputSchema.parse(input);
  const db = getDb();
  if (input.id) {
    const [zone] = await db.select().from(schema.shippingZones).where(eq(schema.shippingZones.id, input.id));
    if (!zone) throw new NotFoundError("Shipping zone not found");
    if (zone.isActive) await assertNoOverlap(data.states, input.id);
    await db.update(schema.shippingZones).set(data).where(eq(schema.shippingZones.id, input.id));
    return { id: input.id };
  }
  await assertNoOverlap(data.states);
  const [created] = await db.insert(schema.shippingZones).values(data).returning({ id: schema.shippingZones.id });
  return created;
}

export async function setShippingZoneActive(actor: Actor, id: string, isActive: boolean): Promise<void> {
  assertAdmin(actor);
  const db = getDb();
  const [zone] = await db.select().from(schema.shippingZones).where(eq(schema.shippingZones.id, id));
  if (!zone) throw new NotFoundError("Shipping zone not found");
  if (isActive) await assertNoOverlap(zone.states, id);
  await db.update(schema.shippingZones).set({ isActive }).where(eq(schema.shippingZones.id, id));
}
