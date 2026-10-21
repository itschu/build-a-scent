"use client";

import { BOTTLE_FORMATS, type BottleFormat } from "@/lib/domain";
import { FORMAT_LABELS } from "@/lib/labels";
import { cn } from "@/lib/cn";
import type { CatalogBottleOption } from "@/server/dal/catalog";

function Choice({ active, disabled, onClick, children }: { active: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "min-w-16 border px-4 py-2.5 font-serif text-xs uppercase tracking-[0.12em] transition-colors",
        active ? "border-gold text-gold" : "border-line text-champagne hover:border-gold-dim",
        disabled && "cursor-not-allowed text-faint line-through decoration-faint/60 hover:border-line",
      )}
    >
      {children}
    </button>
  );
}

/** Size and format picked separately; combinations without a bottle option are disabled. */
export function BottleOptionPicker({
  options,
  value,
  onChange,
}: {
  options: CatalogBottleOption[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  const current = options.find((o) => o.id === value) ?? null;
  const volumes = [...new Set(options.map((o) => o.volumeMl))].sort((a, b) => a - b);
  const formats = BOTTLE_FORMATS.filter((f) => options.some((o) => o.format === f));
  const find = (volumeMl: number, format: BottleFormat) => options.find((o) => o.volumeMl === volumeMl && o.format === format);

  function pickVolume(volumeMl: number) {
    const option = (current && find(volumeMl, current.format)) ?? options.find((o) => o.volumeMl === volumeMl);
    if (option) onChange(option.id);
  }

  function pickFormat(format: BottleFormat) {
    const option = (current && find(current.volumeMl, format)) ?? options.find((o) => o.format === format);
    if (option) onChange(option.id);
  }

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-2 font-serif text-[0.7rem] uppercase tracking-label text-muted">Bottle size</legend>
        <div className="flex flex-wrap gap-2">
          {volumes.map((v) => (
            <Choice key={v} active={current?.volumeMl === v} onClick={() => pickVolume(v)}>
              {v}ml
            </Choice>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 font-serif text-[0.7rem] uppercase tracking-label text-muted">Format</legend>
        <div className="flex flex-wrap gap-2">
          {formats.map((f) => (
            <Choice
              key={f}
              active={current?.format === f}
              disabled={current ? !find(current.volumeMl, f) : false}
              onClick={() => pickFormat(f)}
            >
              {FORMAT_LABELS[f]}
            </Choice>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

/** 50ml spray if offered, otherwise the first option. */
export function defaultBottleOptionId(options: CatalogBottleOption[]): string | null {
  return (options.find((o) => o.volumeMl === 50 && o.format === "spray") ?? options[0])?.id ?? null;
}
