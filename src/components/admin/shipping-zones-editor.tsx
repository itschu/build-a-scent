"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveShippingZoneAction, setShippingZoneActiveAction } from "@/app/(admin)/admin/settings/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { formatNaira, parseNairaToKobo } from "@/lib/money";
import { NIGERIAN_STATES, type NigerianState } from "@/lib/nigeria";

type Zone = { id: string; name: string; states: string[]; feeKobo: number; etaMinDays: number; etaMaxDays: number; isActive: boolean };
type Draft = { id?: string; name: string; states: string[]; fee: string; etaMin: string; etaMax: string };

export function ShippingZonesEditor({ zones }: { zones: Zone[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const covered = new Set(zones.filter((z) => z.isActive).flatMap((z) => z.states));
  const uncovered = NIGERIAN_STATES.filter((s) => !covered.has(s));

  async function save() {
    if (!draft) return;
    const feeKobo = parseNairaToKobo(draft.fee);
    if (feeKobo === null) return setError("Enter the delivery fee in naira.");
    setPending(true);
    setError(null);
    const result = await saveShippingZoneAction({
      id: draft.id,
      name: draft.name,
      states: draft.states as NigerianState[],
      feeKobo,
      etaMinDays: Number.parseInt(draft.etaMin, 10),
      etaMaxDays: Number.parseInt(draft.etaMax, 10),
    });
    setPending(false);
    if (!result.ok) return setError(result.error);
    toast("Shipping zone saved.");
    setDraft(null);
    router.refresh();
  }

  async function toggle(zone: Zone) {
    const result = await setShippingZoneActiveAction(zone.id, !zone.isActive);
    if (!result.ok) return toast(result.error, { tone: "error" });
    router.refresh();
  }

  return (
    <section className="max-w-4xl space-y-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-serif text-[0.7rem] uppercase tracking-label text-gold">Shipping zones</h2>
        {!draft && (
          <Button size="sm" onClick={() => setDraft({ name: "", states: [], fee: "", etaMin: "2", etaMax: "5" })}>
            New zone
          </Button>
        )}
      </div>
      {uncovered.length > 0 && (
        <Notice tone="error">Customers in {uncovered.join(", ")} can&apos;t check out: no active zone covers them.</Notice>
      )}

      {draft && (
        <div className="space-y-5 border border-line bg-surface p-6">
          {error && <Notice tone="error">{error}</Notice>}
          <div className="grid gap-5 sm:grid-cols-4">
            <Field label="Name">{({ id }) => <Input id={id} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />}</Field>
            <Field label="Fee (₦)">{({ id }) => <Input id={id} inputMode="decimal" value={draft.fee} onChange={(e) => setDraft({ ...draft, fee: e.target.value })} />}</Field>
            <Field label="Earliest (days)">{({ id }) => <Input id={id} type="number" min={0} value={draft.etaMin} onChange={(e) => setDraft({ ...draft, etaMin: e.target.value })} />}</Field>
            <Field label="Latest (days)">{({ id }) => <Input id={id} type="number" min={0} value={draft.etaMax} onChange={(e) => setDraft({ ...draft, etaMax: e.target.value })} />}</Field>
          </div>
          <fieldset>
            <legend className="mb-2 font-serif text-[0.7rem] uppercase tracking-label text-muted">States ({draft.states.length})</legend>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-6">
              {NIGERIAN_STATES.map((s) => {
                const checked = draft.states.includes(s);
                return (
                  <label key={s} className={cn("flex cursor-pointer items-center gap-2 text-xs", checked ? "text-gold" : "text-muted")}>
                    <input
                      type="checkbox"
                      className="accent-gold"
                      checked={checked}
                      onChange={() =>
                        setDraft({ ...draft, states: checked ? draft.states.filter((x) => x !== s) : [...draft.states, s] })
                      }
                    />
                    {s}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <div className="flex gap-3">
            <Button pending={pending} onClick={save}>
              Save zone
            </Button>
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto border border-line">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-line bg-coal font-serif text-[0.65rem] uppercase tracking-label text-muted">
            <tr>
              <th className="px-4 py-3">Zone</th>
              <th className="px-4 py-3">States</th>
              <th className="px-4 py-3">Fee</th>
              <th className="px-4 py-3">Delivery</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {zones.map((z) => (
              <tr key={z.id} className={cn(!z.isActive && "opacity-60")}>
                <td className="px-4 py-3 text-champagne">{z.name}</td>
                <td className="px-4 py-3 text-xs text-muted">{z.states.length > 5 ? `${z.states.length} states` : z.states.join(", ")}</td>
                <td className="px-4 py-3">{formatNaira(z.feeKobo)}</td>
                <td className="px-4 py-3 text-muted">{z.etaMinDays}–{z.etaMaxDays} days</td>
                <td className="px-4 py-3">
                  <button type="button" onClick={() => toggle(z)} className={cn("border px-2 py-1 text-xs", z.isActive ? "border-success/40 text-success" : "border-line text-muted")}>
                    {z.isActive ? "Active" : "Inactive"}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    className="text-xs text-gold hover:underline"
                    onClick={() =>
                      setDraft({ id: z.id, name: z.name, states: z.states, fee: String(z.feeKobo / 100), etaMin: String(z.etaMinDays), etaMax: String(z.etaMaxDays) })
                    }
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
