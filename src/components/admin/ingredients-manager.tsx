"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  deleteIngredientAction,
  saveIngredientAction,
  setIngredientActiveAction,
} from "@/app/(admin)/admin/ingredients/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { NOTE_TIERS, type NoteTier } from "@/lib/domain";
import { TIER_LABELS } from "@/lib/labels";
import { formatNaira, parseNairaToKobo } from "@/lib/money";
import type { AdminIngredient } from "@/server/dal/admin-catalog";
import { ImageListEditor } from "./image-uploader";

type Draft = { id?: string; name: string; noteTier: NoteTier; scentFamily: string; colorHex: string; price: string; images: string[] };

const empty: Draft = { name: "", noteTier: "base", scentFamily: "", colorHex: "#c9a84c", price: "", images: [] };

function cascadeMessage(r: { paused: number; restored: number }): string {
  const parts = [];
  if (r.paused) parts.push(`${r.paused} marketplace listing${r.paused === 1 ? "" : "s"} paused`);
  if (r.restored) parts.push(`${r.restored} restored`);
  return parts.length ? ` ${parts.join(", ")}; sellers notified.` : "";
}

export function IngredientsManager({ ingredients }: { ingredients: AdminIngredient[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [tierFilter, setTierFilter] = useState<NoteTier | "all">("all");

  function edit(i: AdminIngredient) {
    setError(null);
    setDraft({
      id: i.id,
      name: i.name,
      noteTier: i.noteTier,
      scentFamily: i.scentFamily,
      colorHex: i.colorHex,
      price: String(i.pricePerMlKobo / 100),
      images: i.imageUrl ? [i.imageUrl] : [],
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    const pricePerMlKobo = parseNairaToKobo(draft.price);
    if (pricePerMlKobo === null) return setError("Enter the price per ml in naira.");
    setPending("save");
    const result = await saveIngredientAction({
      id: draft.id,
      name: draft.name,
      noteTier: draft.noteTier,
      scentFamily: draft.scentFamily,
      colorHex: draft.colorHex,
      pricePerMlKobo,
      imageUrl: draft.images[0] ?? null,
    });
    setPending(null);
    if (!result.ok) return setError(result.error);
    toast(draft.id ? "Ingredient saved." : "Ingredient added.");
    setDraft(null);
    router.refresh();
  }

  async function toggle(i: AdminIngredient) {
    if (i.isActive && !window.confirm(`Deactivate ${i.name}? It disappears from the mixer, scents using it become view-only, and live listings using it are paused.`)) return;
    setPending(i.id);
    const result = await setIngredientActiveAction(i.id, !i.isActive);
    setPending(null);
    if (!result.ok) return toast(result.error, { tone: "error" });
    toast(`${i.name} ${i.isActive ? "deactivated" : "reactivated"}.${cascadeMessage(result.data)}`);
    router.refresh();
  }

  async function remove(i: AdminIngredient) {
    if (!window.confirm(`Delete ${i.name} permanently?`)) return;
    setPending(i.id);
    const result = await deleteIngredientAction(i.id);
    setPending(null);
    if (!result.ok) return toast(result.error, { tone: "error" });
    toast(`${i.name} deleted.`, { tone: "info" });
    router.refresh();
  }

  const shown = ingredients.filter((i) => tierFilter === "all" || i.noteTier === tierFilter);

  return (
    <div className="space-y-8">
      {draft ? (
        <form onSubmit={save} className="max-w-3xl space-y-5 border border-line bg-surface p-6" noValidate>
          <h2 className="font-serif text-sm uppercase tracking-label text-gold">{draft.id ? `Edit ${draft.name}` : "New ingredient"}</h2>
          {error && <Notice tone="error">{error}</Notice>}
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Name">{({ id }) => <Input id={id} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />}</Field>
            <Field label="Note tier" hint={draft.id ? "Can't change once the ingredient is used" : undefined}>
              {({ id, describedBy }) => (
                <Select id={id} value={draft.noteTier} aria-describedby={describedBy} onChange={(e) => setDraft({ ...draft, noteTier: e.target.value as NoteTier })}>
                  {NOTE_TIERS.map((t) => (
                    <option key={t} value={t}>
                      {TIER_LABELS[t]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Scent family" hint="e.g. Woody, Floral">
              {({ id, describedBy }) => (
                <Input id={id} value={draft.scentFamily} aria-describedby={describedBy} onChange={(e) => setDraft({ ...draft, scentFamily: e.target.value })} />
              )}
            </Field>
            <Field label="Price per ml of pure ingredient (₦)" hint="Retail price, margin included">
              {({ id, describedBy }) => (
                <Input id={id} inputMode="decimal" value={draft.price} aria-describedby={describedBy} onChange={(e) => setDraft({ ...draft, price: e.target.value })} />
              )}
            </Field>
            <Field label="Colour">
              {({ id }) => (
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    aria-label="Pick colour"
                    value={draft.colorHex}
                    onChange={(e) => setDraft({ ...draft, colorHex: e.target.value })}
                    className="size-10 cursor-pointer border border-line bg-transparent"
                  />
                  <Input id={id} value={draft.colorHex} onChange={(e) => setDraft({ ...draft, colorHex: e.target.value })} className="max-w-32" />
                </div>
              )}
            </Field>
          </div>
          <div>
            <p className="mb-2 font-serif text-[0.7rem] uppercase tracking-label text-muted">Image (optional)</p>
            <ImageListEditor value={draft.images} onChange={(images) => setDraft({ ...draft, images })} prefix="ingredients" max={1} />
          </div>
          <div className="flex gap-3">
            <Button type="submit" pending={pending === "save"}>
              {draft.id ? "Save ingredient" : "Add ingredient"}
            </Button>
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button onClick={() => (setError(null), setDraft(empty))}>New ingredient</Button>
      )}

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by tier">
        {(["all", ...NOTE_TIERS] as const).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tierFilter === t}
            onClick={() => setTierFilter(t)}
            className={cn("border px-3 py-1.5 text-xs", tierFilter === t ? "border-gold text-gold" : "border-line text-muted")}
          >
            {t === "all" ? "All tiers" : TIER_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto border border-line">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-line bg-coal font-serif text-[0.65rem] uppercase tracking-label text-muted">
            <tr>
              <th className="px-4 py-3">Ingredient</th>
              <th className="px-4 py-3">Tier</th>
              <th className="px-4 py-3">Family</th>
              <th className="px-4 py-3">Price / ml</th>
              <th className="px-4 py-3">Used in</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {shown.map((i) => (
              <tr key={i.id} className={cn(!i.isActive && "opacity-60")}>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-3 text-champagne">
                    <span className="size-5 rounded-full ring-1 ring-white/10" style={{ backgroundColor: i.colorHex }} aria-hidden />
                    {i.name}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted">{TIER_LABELS[i.noteTier]}</td>
                <td className="px-4 py-3 text-muted">{i.scentFamily}</td>
                <td className="px-4 py-3 text-muted">{formatNaira(i.pricePerMlKobo)}</td>
                <td className="px-4 py-3 text-muted">{i.usedBy} {i.usedBy === 1 ? "scent" : "scents"}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggle(i)}
                    disabled={pending === i.id}
                    className={cn("border px-2 py-1 text-xs", i.isActive ? "border-success/40 text-success" : "border-line text-muted")}
                  >
                    {i.isActive ? "Active" : "Inactive"}
                  </button>
                </td>
                <td className="space-x-3 px-4 py-3 text-right text-xs">
                  <button type="button" onClick={() => edit(i)} className="text-gold hover:underline">
                    Edit
                  </button>
                  {!i.referenced && (
                    <button type="button" onClick={() => remove(i)} className="text-danger hover:underline">
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
