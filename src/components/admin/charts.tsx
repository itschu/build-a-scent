import { cn } from "@/lib/cn";

/** Headline number with a short label (a KPI tile, not a chart). */
export function StatTile({ label, value, note, href }: { label: string; value: string; note?: string; href?: string }) {
  const body = (
    <>
      <p className="font-serif text-[0.65rem] uppercase tracking-label text-muted">{label}</p>
      <p className="mt-2 font-sans text-3xl tabular-nums text-cream">{value}</p>
      {note && <p className="mt-1 text-xs text-faint">{note}</p>}
    </>
  );
  const className = "block border border-line bg-surface p-5";
  return href ? (
    <a href={href} className={cn(className, "transition-colors hover:border-gold-dim")}>
      {body}
    </a>
  ) : (
    <div className={className}>{body}</div>
  );
}

export type BarDatum = { label: string; value: number; display: string; detail?: string; swatch?: string };

/**
 * Ranked horizontal bars for one series (magnitude): a single brand hue, thin bars anchored
 * at zero with rounded data ends, values labelled directly, and a hover tooltip per row.
 * The labelled rows double as the table view.
 */
export function BarList({ title, data, empty = "No data yet." }: { title: string; data: BarDatum[]; empty?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <figure className="border border-line bg-surface p-5">
      <figcaption className="mb-4 font-serif text-[0.7rem] uppercase tracking-label text-gold">{title}</figcaption>
      {data.length === 0 ? (
        <p className="text-sm text-faint">{empty}</p>
      ) : (
        <ul className="space-y-3">
          {data.map((d) => (
            <li key={d.label} title={`${d.label}: ${d.display}${d.detail ? ` · ${d.detail}` : ""}`} className="group">
              <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2 text-champagne">
                  {d.swatch && <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.swatch }} aria-hidden />}
                  <span className="truncate">{d.label}</span>
                </span>
                <span className="shrink-0 tabular-nums text-muted">
                  {d.display}
                  {d.detail && <span className="ml-2 text-faint">{d.detail}</span>}
                </span>
              </div>
              <div className="h-2 w-full bg-line-soft" aria-hidden>
                <div
                  className="h-full rounded-r-[4px] bg-gold transition-opacity group-hover:opacity-80"
                  style={{ width: `${(d.value / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}
