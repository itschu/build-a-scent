import { NOTE_TIERS } from "@/lib/domain";
import { TIER_LABELS } from "@/lib/labels";
import type { NoteProfile } from "@/lib/note-profile";

/** Recipe-protected notes: featured ingredients plus each tier's scent families. */
export function NoteProfileList({ profile, className = "text-xs" }: { profile: NoteProfile; className?: string }) {
  return (
    <dl className={`space-y-1 ${className}`}>
      {NOTE_TIERS.map((tier) => (
        <div key={tier} className="flex gap-3">
          <dt className="w-16 shrink-0 font-serif uppercase tracking-label text-gold">{TIER_LABELS[tier]}</dt>
          <dd className="text-muted">
            {profile[tier].featured.map((n) => (
              <span key={n} className="mr-2 text-champagne">
                {n}
              </span>
            ))}
            {profile[tier].families.map((f) => `${f} accord`).join(" · ") || "—"}
          </dd>
        </div>
      ))}
    </dl>
  );
}
