"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { updateSettingsAction } from "@/app/(admin)/admin/settings/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { toast } from "@/components/ui/toast";
import { parseNairaToKobo } from "@/lib/money";
import type { SettingValues } from "@/lib/settings";

type FieldDef = { key: keyof SettingValues; label: string; hint: string; kind: "number" | "naira" };

const GROUPS: Array<{ title: string; fields: FieldDef[] }> = [
  {
    title: "Marketplace",
    fields: [
      { key: "commission_pct", label: "Commission (%)", hint: "Taken from the creator's markup at the moment of sale", kind: "number" },
      { key: "min_creator_markup_kobo", label: "Minimum creator markup (₦)", hint: "Lowest markup a seller can set", kind: "naira" },
    ],
  },
  {
    title: "Pricing",
    fields: [
      { key: "tier_share_base", label: "Base tier share (%)", hint: "Share of the concentrate", kind: "number" },
      { key: "tier_share_heart", label: "Heart tier share (%)", hint: "Base + heart + top must be 100", kind: "number" },
      { key: "tier_share_top", label: "Top tier share (%)", hint: "", kind: "number" },
      { key: "usd_exchange_rate", label: "USD display rate (₦ per $1)", hint: "Display only; checkout is always NGN", kind: "number" },
    ],
  },
  {
    title: "Operations",
    fields: [
      { key: "production_lead_days", label: "Production lead time (days)", hint: "Added to each zone's delivery estimate", kind: "number" },
      { key: "low_stock_reserve_threshold", label: "Low-stock hold threshold", hint: "Shop variants at or below this are held during checkout", kind: "number" },
      { key: "reservation_ttl_minutes", label: "Stock hold length (minutes)", hint: "How long a checkout holds low-stock items", kind: "number" },
      { key: "payment_window_minutes", label: "Payment window (minutes)", hint: "Unpaid checkouts expire after this", kind: "number" },
    ],
  },
];

export function SettingsForm({ settings }: { settings: SettingValues }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      GROUPS.flatMap((g) => g.fields).map((f) => [f.key, f.kind === "naira" ? String(settings[f.key] / 100) : String(settings[f.key])]),
    ),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const shareTotal = ["tier_share_base", "tier_share_heart", "tier_share_top"].reduce((s, k) => s + (Number(values[k]) || 0), 0);

  async function save(event: FormEvent) {
    event.preventDefault();
    const payload: Record<string, number> = {};
    for (const f of GROUPS.flatMap((g) => g.fields)) {
      const n = f.kind === "naira" ? parseNairaToKobo(values[f.key]) : Number(values[f.key]);
      if (n === null || Number.isNaN(n)) return setError(`${f.label}: enter a number.`);
      payload[f.key] = n;
    }
    setPending(true);
    setError(null);
    const result = await updateSettingsAction(payload);
    setPending(false);
    if (!result.ok) return setError(result.error);
    toast("Settings saved. Prices update immediately.");
    router.refresh();
  }

  return (
    <form onSubmit={save} className="max-w-4xl space-y-8" noValidate>
      {error && <Notice tone="error">{error}</Notice>}
      {GROUPS.map((group) => (
        <fieldset key={group.title} className="border border-line bg-surface p-6">
          <legend className="px-2 font-serif text-[0.7rem] uppercase tracking-label text-gold">{group.title}</legend>
          <div className="grid gap-5 sm:grid-cols-2">
            {group.fields.map((f) => (
              <Field key={f.key} label={f.label} hint={f.hint || undefined}>
                {({ id, describedBy }) => (
                  <Input
                    id={id}
                    inputMode="decimal"
                    value={values[f.key]}
                    aria-describedby={describedBy}
                    onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                  />
                )}
              </Field>
            ))}
          </div>
          {group.title === "Pricing" && (
            <p className={shareTotal === 100 ? "mt-4 text-xs text-faint" : "mt-4 text-xs text-danger"}>Tier shares total: {shareTotal}%</p>
          )}
        </fieldset>
      ))}
      <Button type="submit" pending={pending}>
        Save settings
      </Button>
    </form>
  );
}
