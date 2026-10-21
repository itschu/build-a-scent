"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveBottleOptionAction, setBottleOptionActiveAction } from "@/app/(admin)/admin/ingredients/actions";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { BOTTLE_FORMATS, type BottleFormat } from "@/lib/domain";
import { FORMAT_LABELS } from "@/lib/labels";
import { parseNairaToKobo } from "@/lib/money";

type Option = {
  id: string;
  volumeMl: number;
  format: BottleFormat;
  concentrationPct: number;
  basePriceKobo: number;
  isActive: boolean;
  sortOrder: number;
};

export function BottleOptionsManager({ options }: { options: Option[] }) {
  return (
    <div className="overflow-x-auto border border-line">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-line bg-coal font-serif text-[0.65rem] uppercase tracking-label text-muted">
          <tr>
            <th className="px-3 py-3">Volume (ml)</th>
            <th className="px-3 py-3">Format</th>
            <th className="px-3 py-3">Concentration %</th>
            <th className="px-3 py-3">Base price (₦)</th>
            <th className="px-3 py-3">Order</th>
            <th className="px-3 py-3">Status</th>
            <th className="px-3 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
          {options.map((o) => (
            <Row key={o.id} option={o} />
          ))}
          <Row key={`new-${options.length}`} />
        </tbody>
      </table>
    </div>
  );
}

function Row({ option }: { option?: Option }) {
  const router = useRouter();
  const [volume, setVolume] = useState(option ? String(option.volumeMl) : "");
  const [format, setFormat] = useState<BottleFormat>(option?.format ?? "spray");
  const [concentration, setConcentration] = useState(option ? String(option.concentrationPct) : "20");
  const [price, setPrice] = useState(option ? String(option.basePriceKobo / 100) : "");
  const [sortOrder, setSortOrder] = useState(option ? String(option.sortOrder) : "0");
  const [pending, setPending] = useState(false);

  async function save() {
    const basePriceKobo = parseNairaToKobo(price);
    if (basePriceKobo === null) return toast("Enter a valid base price.", { tone: "error" });
    setPending(true);
    const result = await saveBottleOptionAction({
      id: option?.id,
      volumeMl: Number.parseInt(volume, 10),
      format,
      concentrationPct: Number.parseInt(concentration, 10),
      basePriceKobo,
      sortOrder: Number.parseInt(sortOrder, 10) || 0,
    });
    setPending(false);
    if (!result.ok) return toast(result.error, { tone: "error" });
    toast(option ? "Bottle option saved." : "Bottle option added.");
    router.refresh();
  }

  async function toggle() {
    if (!option) return;
    if (option.isActive && !window.confirm("Deactivate this bottle option? Scents and listings using it can't be ordered until it's back.")) return;
    setPending(true);
    const result = await setBottleOptionActiveAction(option.id, !option.isActive);
    setPending(false);
    if (!result.ok) return toast(result.error, { tone: "error" });
    toast(`Bottle option ${option.isActive ? "deactivated" : "reactivated"}.`);
    router.refresh();
  }

  return (
    <tr className={cn(option && !option.isActive && "opacity-60")}>
      <td className="px-3 py-2"><Input aria-label="Volume in ml" type="number" min={1} value={volume} onChange={(e) => setVolume(e.target.value)} className="w-24 py-1.5" /></td>
      <td className="px-3 py-2">
        <Select aria-label="Format" value={format} onChange={(e) => setFormat(e.target.value as BottleFormat)} className="py-1.5">
          {BOTTLE_FORMATS.map((f) => (
            <option key={f} value={f}>{FORMAT_LABELS[f]}</option>
          ))}
        </Select>
      </td>
      <td className="px-3 py-2"><Input aria-label="Concentration percent" type="number" min={1} max={100} value={concentration} onChange={(e) => setConcentration(e.target.value)} className="w-24 py-1.5" /></td>
      <td className="px-3 py-2"><Input aria-label="Base price in naira" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className="w-32 py-1.5" /></td>
      <td className="px-3 py-2"><Input aria-label="Sort order" type="number" min={0} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="w-20 py-1.5" /></td>
      <td className="px-3 py-2 text-xs">
        {option ? (
          <button type="button" onClick={toggle} disabled={pending} className={option.isActive ? "text-success" : "text-muted"}>
            {option.isActive ? "Active" : "Inactive"}
          </button>
        ) : (
          <span className="text-faint">New</span>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        <Button size="sm" variant={option ? "ghost" : "primary"} pending={pending} onClick={save} disabled={!volume || !price}>
          {option ? "Save" : "Add"}
        </Button>
      </td>
    </tr>
  );
}
