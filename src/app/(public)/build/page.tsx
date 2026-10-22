import type { Metadata } from "next";
import { Suspense } from "react";
import { MixerWizard } from "@/components/mixer/mixer-wizard";
import { amountsFromFormula, selectionsFromFormula, type MixerSnapshot } from "@/lib/mixer/state";
import { tierSharesFrom } from "@/lib/settings";
import { getActor } from "@/server/auth/session";
import { getMixerCatalog, type MixerCatalog } from "@/server/cached";
import { NotFoundError } from "@/server/dal/actor";
import { getBottleOption, getIngredientsByIds } from "@/server/dal/catalog";
import { scentAvailability } from "@/server/dal/library";
import { getOwnScentForMixer } from "@/server/dal/scents";
import { getSharedScent } from "@/server/dal/sharing";

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
  // Request data first: cached database reads must never run during `next build`.
  const params = await searchParams;
  const catalog = await getMixerCatalog();
  const draftId = typeof params.draft === "string" ? params.draft : null;
  const fromId = typeof params.from === "string" ? params.from : null;
  const shareToken = typeof params.share === "string" ? params.share : null;
  const initial = draftId
    ? await loadOwnScent(catalog, draftId, "draft")
    : fromId
      ? await loadOwnScent(catalog, fromId, "edit")
      : shareToken
        ? await loadSharedScent(catalog, shareToken)
        : {};

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
    if (mode === "edit" && scent.status === "saved") {
      // View-only scents (discontinued ingredient or bottle) can't be edited (Flow 7). Checked
      // against live data rather than the cached catalog.
      const [ingredients, bottle] = await Promise.all([
        getIngredientsByIds(scent.formula.map((e) => e.ingredientId)),
        scent.bottleOptionId ? getBottleOption(scent.bottleOptionId) : null,
      ]);
      if (!scentAvailability(scent.formula, ingredients, bottle).available) {
        return { notice: "That scent uses an ingredient or bottle that's no longer available, so it can't be edited." };
      }
    }
    const snapshot: Partial<MixerSnapshot> =
      mode === "draft" && scent.status === "draft"
        ? { draftId: scent.id, step: scent.currentStep ?? "base" }
        : { parentScentId: scent.status === "saved" ? scent.id : null, step: "preview" };
    return {
      snapshot: {
        ...snapshot,
        selections: selectionsFromFormula(formula),
        amounts: amountsFromFormula(formula, tierSharesFrom(catalog.settings)),
        name: scent.name ?? "",
        bottleOptionId,
      },
      notice: dropped ? "Some ingredients in this blend are no longer available and were removed. Top up the bottle to finish it." : undefined,
    };
  } catch (error) {
    if (error instanceof NotFoundError) return { notice: "We couldn't find that scent, so you're starting fresh." };
    throw error;
  }
}

/** "Build your own" from a shared scent: the viewer starts from a copy of the formula. */
async function loadSharedScent(catalog: MixerCatalog, token: string): Promise<Initial> {
  const scent = await getSharedScent(token);
  if (!scent || scent.kind !== "formula" || !scent.availability.available) {
    return { notice: "That shared blend isn't available to copy, so you're starting fresh." };
  }
  return {
    snapshot: {
      selections: selectionsFromFormula(scent.formula),
      amounts: amountsFromFormula(scent.formula, tierSharesFrom(catalog.settings)),
      bottleOptionId: scent.bottle?.id ?? null,
      step: "preview",
    },
    notice: `Starting from "${scent.name}". Make it your own, then save it to your library.`,
  };
}
