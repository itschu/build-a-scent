"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { updateSettingsAction } from "@/app/(admin)/admin/settings/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { toast } from "@/components/ui/toast";
import { parseNairaToKobo } from "@/lib/money";
import type { SettingValues } from "@/lib/settings";

type Key = keyof SettingValues;
type FieldDef =
  | { key: Key; label: string; hint?: string; kind: "number" | "naira" | "text" }
  | { key: Key; label: string; hint?: string; kind: "toggle" }
  | { key: Key; label: string; hint?: string; kind: "select"; options: Array<{ value: string; label: string }> };

const GROUPS: Array<{ title: string; fields: FieldDef[] }> = [
  {
    title: "Store",
    fields: [
      { key: "checkout_enabled", label: "Checkout open", hint: "Turn off to pause all purchases (e.g. during a restock or holiday)", kind: "toggle" },
      { key: "checkout_paused_message", label: "Message while checkout is paused", hint: "Shown in the cart and at checkout", kind: "text" },
      { key: "listings_enabled", label: "Accept new marketplace listings", hint: "Existing listings stay live either way", kind: "toggle" },
      { key: "signups_enabled", label: "Allow new sign-ups", hint: "Existing customers can still sign in", kind: "toggle" },
    ],
  },
  {
    title: "Selling rules",
    fields: [
      { key: "listing_auto_approve", label: "Approve new listings automatically", hint: "Off: every listing waits for your review", kind: "toggle" },
      { key: "max_active_listings_per_seller", label: "Max active listings per seller", hint: "Live or awaiting review. 0 = no limit", kind: "number" },
      { key: "listing_required_orders", label: "Delivered orders needed before listing", hint: "0 = sellers can list straight away", kind: "number" },
      {
        key: "listing_order_scope",
        label: "Orders that count",
        hint: "Only delivered orders count",
        kind: "select",
        options: [
          { value: "same_scent", label: "Orders of the scent being listed" },
          { value: "any", label: "Any orders on the platform" },
        ],
      },
    ],
  },
  {
    title: "Marketplace",
    fields: [
      { key: "commission_pct", label: "Commission (%)", hint: "Taken from the creator's markup at the moment of sale", kind: "number" },
      { key: "min_creator_markup_kobo", label: "Minimum creator markup (₦)", hint: "Lowest markup a seller can set", kind: "naira" },
    ],
  },
  {
    title: "Orders",
    fields: [
      { key: "free_shipping_threshold_kobo", label: "Free shipping from (₦)", hint: "Orders at or above this ship free. 0 = off", kind: "naira" },
      { key: "min_order_kobo", label: "Minimum order (₦)", hint: "Before shipping. 0 = no minimum", kind: "naira" },
      { key: "max_line_quantity", label: "Max quantity per item", hint: "Per cart line, 1–50", kind: "number" },
    ],
  },
  {
    title: "Pricing",
    fields: [
      { key: "tier_share_base", label: "Base tier share (%)", hint: "Suggested split in the mixer; prices older blends", kind: "number" },
      { key: "tier_share_heart", label: "Heart tier share (%)", hint: "Base + heart + top must be 100", kind: "number" },
      { key: "tier_share_top", label: "Top tier share (%)", kind: "number" },
      { key: "usd_exchange_rate", label: "USD display rate (₦ per $1)", hint: "Display only; checkout is always NGN", kind: "number" },
    ],
  },
  {
    title: "Storefront",
    fields: [
      { key: "announcement_text", label: "Announcement bar", hint: "Shown at the top of every page. Leave empty to hide", kind: "text" },
      { key: "support_email", label: "Support email", hint: "Shown in the footer and order emails", kind: "text" },
      { key: "support_phone", label: "Support phone / WhatsApp", hint: "Shown in the footer and order emails", kind: "text" },
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

const FIELDS = GROUPS.flatMap((g) => g.fields);

/** Form state: text inputs hold strings, toggles hold booleans. */
function initialValues(settings: SettingValues): Record<string, string | boolean> {
  return Object.fromEntries(
    FIELDS.map((f) => {
      const value = settings[f.key];
      if (f.kind === "toggle") return [f.key, Boolean(value)];
      if (f.kind === "naira") return [f.key, String((value as number) / 100)];
      return [f.key, String(value)];
    }),
  );
}

export function SettingsForm({ settings }: { settings: SettingValues }) {
  const router = useRouter();
  const [values, setValues] = useState(() => initialValues(settings));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const shareTotal = ["tier_share_base", "tier_share_heart", "tier_share_top"].reduce((s, k) => s + (Number(values[k]) || 0), 0);
  const set = (key: Key, value: string | boolean) => setValues((v) => ({ ...v, [key]: value }));

  async function save(event: FormEvent) {
    event.preventDefault();
    const payload: Record<string, unknown> = {};
    for (const f of FIELDS) {
      const raw = values[f.key];
      if (f.kind === "toggle" || f.kind === "text" || f.kind === "select") {
        payload[f.key] = raw;
        continue;
      }
      const n = f.kind === "naira" ? parseNairaToKobo(String(raw)) : Number(raw);
      if (n === null || Number.isNaN(n) || String(raw).trim() === "") return setError(`${f.label}: enter a number.`);
      payload[f.key] = n;
    }
    setPending(true);
    setError(null);
    const result = await updateSettingsAction(payload);
    setPending(false);
    if (!result.ok) return setError(result.error);
    toast("Settings saved. They apply immediately.");
    router.refresh();
  }

  return (
    <form onSubmit={save} className="max-w-4xl space-y-8" noValidate>
      {error && <Notice tone="error">{error}</Notice>}
      {GROUPS.map((group) => (
        <fieldset key={group.title} className="border border-line bg-surface p-6">
          <legend className="px-2 font-serif text-[0.7rem] uppercase tracking-label text-gold">{group.title}</legend>
          <div className="grid gap-5 sm:grid-cols-2">
            {group.fields.map((f) =>
              f.kind === "toggle" ? (
                <label key={f.key} className="flex cursor-pointer items-start gap-3 sm:col-span-1">
                  <input
                    type="checkbox"
                    checked={Boolean(values[f.key])}
                    onChange={(e) => set(f.key, e.target.checked)}
                    className="mt-1 size-4 accent-gold"
                  />
                  <span>
                    <span className="block text-sm text-champagne">{f.label}</span>
                    {f.hint && <span className="mt-1 block text-xs text-faint">{f.hint}</span>}
                  </span>
                </label>
              ) : (
                <Field key={f.key} label={f.label} hint={f.hint}>
                  {({ id, describedBy }) =>
                    f.kind === "select" ? (
                      <Select id={id} value={String(values[f.key])} aria-describedby={describedBy} onChange={(e) => set(f.key, e.target.value)}>
                        {f.options.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <Input
                        id={id}
                        inputMode={f.kind === "text" ? undefined : "decimal"}
                        type={f.key === "support_email" ? "email" : "text"}
                        value={String(values[f.key])}
                        aria-describedby={describedBy}
                        onChange={(e) => set(f.key, e.target.value)}
                      />
                    )
                  }
                </Field>
              ),
            )}
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
