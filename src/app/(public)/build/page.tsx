import type { Metadata } from "next";
import { Suspense } from "react";
import { MixerWizard } from "@/components/mixer/mixer-wizard";
import { selectionsFromFormula, type MixerSnapshot } from "@/lib/mixer/state";
import { getActor } from "@/server/auth/session";
import { getMixerCatalog, type MixerCatalog } from "@/server/cached";
import { NotFoundError } from "@/server/dal/actor";
import { getOwnScentForMixer } from "@/server/dal/scents";

export const metadata: Metadata = {
  title: "Build your scent · Build a Scent",
  description: "Blend base, heart and top notes into a fragrance that is uniquely yours.",
};

export default function BuildPage({ searchParams }: PageProps<"/build">) {
  return (
    <Suspense fallback={<div className="flex flex-1 items-center justify-center p-16 text-sm text-muted">Preparing the mixer…</div>}>
      <MixerLoader searchParams={searchParams} />
    </Suspense>
  );
}

type Initial = { snapshot?: Partial<MixerSnapshot>; notice?: string };

async function MixerLoader({ searchParams }: { searchParams: PageProps<"/build">["searchParams"] }) {
  const [catalog, params] = await Promise.all([getMixerCatalog(), searchParams]);
  const draftId = typeof params.draft === "string" ? params.draft : null;
  const fromId = typeof params.from === "string" ? params.from : null;
  const initial = draftId || fromId ? await loadOwnScent(catalog, (draftId ?? fromId)!, draftId ? "draft" : "edit") : {};

  return <MixerWizard catalog={catalog} initialSnapshot={initial.snapshot} initialNotice={initial.notice} />;
}

/** Loads a draft (Resume) or saved scent (Edit), dropping ingredients that are no longer sold. */
async function loadOwnScent(catalog: MixerCatalog, id: string, mode: "draft" | "edit"): Promise<Initial> {
  const actor = await getActor();
  if (actor.kind !== "user") return { notice: "Sign in to open your saved scents." };
  try {
    const scent = await getOwnScentForMixer(actor, id);
    const active = new Set(catalog.ingredients.map((i) => i.id));
    const formula = scent.formula.filter((e) => active.has(e.ingredientId));
    const bottleOptionId = catalog.bottleOptions.some((o) => o.id === scent.bottleOptionId) ? scent.bottleOptionId : null;
    const dropped = formula.length < scent.formula.length;
    const snapshot: Partial<MixerSnapshot> =
      mode === "draft" && scent.status === "draft"
        ? { draftId: scent.id, step: scent.currentStep ?? "base" }
        : { parentScentId: scent.status === "saved" ? scent.id : null, step: "preview" };
    return {
      snapshot: { ...snapshot, selections: selectionsFromFormula(formula), name: scent.name ?? "", bottleOptionId },
      notice: dropped ? "Some ingredients in this blend are no longer available and were removed." : undefined,
    };
  } catch (error) {
    if (error instanceof NotFoundError) return { notice: "We couldn't find that scent, so you're starting fresh." };
    throw error;
  }
}
