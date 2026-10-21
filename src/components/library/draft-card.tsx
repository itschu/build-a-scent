"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteDraftAction } from "@/app/(user)/library/actions";
import { BottleVisual } from "@/components/scent/bottle-visual";
import { Button, buttonClasses } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { formatDate } from "@/lib/dates";
import { TIER_LABELS } from "@/lib/labels";
import type { LibraryScent } from "@/server/dal/library";
import { layersOf, ScentNotes } from "./scent-notes";

export function DraftCard({ scent }: { scent: LibraryScent }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const step = scent.currentStep;
  const stepLabel = !step ? null : step === "preview" ? "Name & preview" : `${TIER_LABELS[step]} notes`;

  async function remove() {
    if (!window.confirm(`Delete "${scent.name || "Untitled draft"}"? This can't be undone.`)) return;
    setPending(true);
    const result = await deleteDraftAction(scent.id);
    setPending(false);
    if (!result.ok) return toast(result.error, { tone: "error" });
    toast("Draft deleted.", { tone: "info" });
    router.refresh();
  }

  return (
    <article className="flex flex-col border border-dashed border-line bg-surface">
      <div className="flex gap-4 p-5">
        <BottleVisual layers={layersOf(scent.ingredients)} className="h-32 w-20 shrink-0" />
        <div className="min-w-0 flex-1">
          <h2 className="mb-1 truncate font-serif text-lg text-cream">{scent.name || "Untitled draft"}</h2>
          <p className="mb-3 text-xs text-faint">
            Edited {formatDate(scent.updatedAt)}
            {stepLabel && ` · stopped at ${stepLabel}`}
          </p>
          <ScentNotes ingredients={scent.ingredients} />
        </div>
      </div>
      <div className="mt-auto flex gap-2 border-t border-line p-4">
        <Link href={`/build?draft=${scent.id}`} className={buttonClasses({ size: "sm" })}>
          Resume
        </Link>
        <Button variant="danger" size="sm" onClick={remove} pending={pending}>
          Delete
        </Button>
      </div>
    </article>
  );
}
