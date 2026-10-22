"use client";

import {
  DndContext,
  DragOverlay,
  MouseSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useReducer, useRef, useState } from "react";
import { saveDraftAction, saveScentAction } from "@/app/(public)/build/actions";
import { useAuthedAction } from "@/components/auth/auth-gate";
import { BottleVisual, layersFrom, type BottleGuide, type BottleSegment } from "@/components/scent/bottle-visual";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { toast } from "@/components/ui/toast";
import { useCartStore } from "@/lib/cart/store";
import { cn } from "@/lib/cn";
import { MIXER_STEPS, NOTE_TIERS, POUR_STEP_PCT, type MixerStep, type NoteTier } from "@/lib/domain";
import { TIER_LABELS, bottleLabel } from "@/lib/labels";
import {
  blendBlocker,
  blendPct,
  canVisit,
  formulaFromSelections,
  initialMixerState,
  isComplete,
  isSavedUnchanged,
  isTierStep,
  mixerReducer,
  pourBlocker,
  snapshotOf,
  tierBlocker,
  tierPct,
  type MixerSnapshot,
} from "@/lib/mixer/state";
import { mixColors } from "@/lib/color";
import { blendPriceKobo } from "@/lib/pricing";
import { tierSharesFrom } from "@/lib/settings";
import { scentNameSchema } from "@/lib/validation/scent";
import type { MixerCatalog } from "@/server/cached";
import type { CatalogIngredient } from "@/server/dal/catalog";
import { defaultBottleOptionId } from "./bottle-option-picker";
import { BOTTLE_DROP_ID, PourList, PourTarget } from "./drop-zone";
import { IngredientDragPreview, IngredientVial } from "./ingredient-vial";
import { MixerPreview } from "./mixer-preview";

const STEP_COPY: Record<NoteTier, { heading: string; sub: string }> = {
  base: { heading: "Base Notes", sub: "Pour 1–3 ingredients that anchor your scent and linger longest." },
  heart: { heading: "Heart Notes", sub: "Pour 1–3 ingredients that form the soul of your scent." },
  top: { heading: "Top Notes", sub: "Pour 1–3 ingredients for the bright first impression, and fill the bottle." },
};

const DRAG_POUR_DELAY_MS = 450;
const DRAG_POUR_REPEAT_MS = 220;

const PENDING = {
  saveDraft: "mixer:save_draft",
  saveScent: "mixer:save_scent",
  saveThenList: "mixer:save_then_list",
} as const;

export function MixerWizard({
  catalog,
  initialSnapshot,
  initialNotice,
}: {
  catalog: MixerCatalog;
  initialSnapshot?: Partial<MixerSnapshot>;
  initialNotice?: string;
}) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const addToCart = useCartStore((s) => s.addItem);
  const [state, dispatch] = useReducer(mixerReducer, undefined, () =>
    // Restoring validates the starting step against the loaded selections.
    mixerReducer(initialMixerState(), {
      type: "restore",
      snapshot: {
        ...snapshotOf(initialMixerState()),
        bottleOptionId: defaultBottleOptionId(catalog.bottleOptions),
        ...initialSnapshot,
      },
    }),
  );
  const [direction, setDirection] = useState(1);
  const [dragging, setDragging] = useState<CatalogIngredient | null>(null);
  const [busy, setBusy] = useState<null | "draft" | "save" | "list">(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [tierMessage, setTierMessage] = useState<string | null>(null);
  /** The vial picked up on this step; tapping the bottle pours from it. */
  const [picked, setPicked] = useState<string | null>(null);
  const [pour, setPour] = useState<{ key: number; color: string } | null>(null);
  // A stable ID keeps dnd-kit's accessibility IDs the same on the server and the client.
  const dndId = useId();
  const dragPour = useRef<{ timer: ReturnType<typeof setTimeout> | null; poured: boolean }>({ timer: null, poured: false });
  const headingRef = useRef<HTMLHeadingElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);

  const byId = useMemo(() => new Map(catalog.ingredients.map((i) => [i.id, i])), [catalog.ingredients]);
  const shares = tierSharesFrom(catalog.settings);
  const layers = layersFrom(state.selections, (id) => byId.get(id)?.colorHex);
  const segments: BottleSegment[] = NOTE_TIERS.flatMap((t) =>
    state.selections[t].map((id) => ({ id, color: byId.get(id)?.colorHex ?? "#000000", pct: state.amounts[id] ?? 0 })),
  );
  // Dashed markers at the suggested split (the platform's default tier shares).
  const guides: BottleGuide[] = [
    { pct: shares.base, label: "heart" },
    { pct: shares.base + shares.heart, label: "top" },
  ];
  const filled = blendPct(state);
  const stepIndex = MIXER_STEPS.indexOf(state.step);
  const bottle = catalog.bottleOptions.find((o) => o.id === state.bottleOptionId) ?? null;
  const formula = formulaFromSelections(state.selections, state.amounts);
  const complete = isComplete(state);
  const priceKobo = complete && bottle ? blendPriceKobo(formula, byId, bottle, shares) : null;

  // On step change, bring the new step into view and move focus to its heading.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const section = sectionRef.current;
    // The sticky site header is 64px; on phones the pinned bottle panel sits below it.
    const covered = window.matchMedia("(min-width: 1024px)").matches ? 64 : 224;
    if (section && section.getBoundingClientRect().top < covered) {
      section.scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" });
    }
    headingRef.current?.focus({ preventScroll: true });
  }, [state.step, reduceMotion]);

  // Touch uses tap-to-pick and tap-to-pour, so only a mouse drags vials (touch keeps scrolling).
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 6 } }));

  /** Pours one measure of an ingredient into its tier, or explains why it can't. */
  function pourInto(tier: NoteTier, ingredientId: string): boolean {
    const blocker = pourBlocker(state, tier, ingredientId);
    if (blocker) {
      setTierMessage(blocker);
      return false;
    }
    setTierMessage(null);
    dispatch({ type: "pour", tier, ingredientId });
    setPour({ key: Date.now(), color: byId.get(ingredientId)?.colorHex ?? "#c9a84c" });
    return true;
  }
  // Timers (hold to pour, drag-and-hold) call the latest version, with the latest state.
  const pourRef = useRef(pourInto);
  useEffect(() => {
    pourRef.current = pourInto;
  });

  function pourBack(tier: NoteTier, ingredientId: string) {
    setTierMessage(null);
    dispatch({ type: "pourBack", tier, ingredientId });
  }

  function remove(tier: NoteTier, ingredientId: string) {
    setTierMessage(null);
    if (picked === ingredientId) setPicked(null);
    dispatch({ type: "remove", tier, ingredientId });
  }

  function pick(tier: NoteTier, ingredientId: string) {
    if (picked === ingredientId) return setPicked(null);
    const blocker = pourBlocker(state, tier, ingredientId);
    if (blocker) return setTierMessage(blocker);
    setTierMessage(null);
    setPicked(ingredientId);
  }

  function stopDragPour() {
    if (dragPour.current.timer) clearTimeout(dragPour.current.timer);
    dragPour.current.timer = null;
  }

  function onDragStart(event: DragStartEvent) {
    dragPour.current.poured = false;
    setDragging(byId.get(event.active.data.current?.ingredientId as string) ?? null);
  }

  // Holding a dragged vial over the bottle keeps pouring.
  function onDragOver(event: DragOverEvent) {
    stopDragPour();
    const ingredientId = event.active.data.current?.ingredientId as string | undefined;
    const tier = ingredientId ? byId.get(ingredientId)?.noteTier : undefined;
    if (!ingredientId || !tier || tier !== state.step || event.over?.id !== BOTTLE_DROP_ID) return;
    const repeat = (delay: number) => {
      dragPour.current.timer = setTimeout(() => {
        if (!pourRef.current(tier, ingredientId)) return;
        dragPour.current.poured = true;
        repeat(DRAG_POUR_REPEAT_MS);
      }, delay);
    };
    repeat(DRAG_POUR_DELAY_MS);
  }

  function onDragEnd(event: DragEndEvent) {
    stopDragPour();
    setDragging(null);
    const ingredientId = event.active.data.current?.ingredientId as string | undefined;
    if (!ingredientId || event.over?.id !== BOTTLE_DROP_ID || dragPour.current.poured) return;
    const tier = byId.get(ingredientId)?.noteTier;
    if (tier && tier === state.step) pourInto(tier, ingredientId);
  }

  function go(step: MixerStep) {
    setDirection(MIXER_STEPS.indexOf(step) >= stepIndex ? 1 : -1);
    setTierMessage(null);
    setPicked(null);
    dispatch({ type: "goTo", step });
  }

  function validName(name: string): string | null {
    const parsed = scentNameSchema.safeParse(name);
    if (parsed.success) return parsed.data;
    setNameError(parsed.error.issues[0].message);
    return null;
  }

  // --- Actions that need an account. Each restores the snapshot first, so they also work
  // after the Google sign-in redirect reloads the page.

  async function persistScent(snapshot: MixerSnapshot): Promise<string | null> {
    if (isSavedUnchanged(state) && state.savedScentId) return state.savedScentId;
    const name = validName(snapshot.name);
    if (!name || !snapshot.bottleOptionId) return null;
    const result = await saveScentAction({
      name,
      formula: formulaFromSelections(snapshot.selections, snapshot.amounts),
      bottleOptionId: snapshot.bottleOptionId,
      parentScentId: snapshot.parentScentId,
      draftId: snapshot.draftId,
    });
    if (!result.ok) {
      toast(result.error, { tone: "error" });
      return null;
    }
    dispatch({ type: "scentSaved", scentId: result.data.id });
    return result.data.id;
  }

  const requestSaveDraft = useAuthedAction<MixerSnapshot>(PENDING.saveDraft, async (snapshot) => {
    dispatch({ type: "restore", snapshot });
    setBusy("draft");
    const result = await saveDraftAction({
      draftId: snapshot.draftId,
      name: snapshot.name,
      formula: formulaFromSelections(snapshot.selections, snapshot.amounts),
      bottleOptionId: snapshot.bottleOptionId,
      currentStep: snapshot.step,
      parentScentId: snapshot.parentScentId,
    });
    setBusy(null);
    if (!result.ok) return toast(result.error, { tone: "error" });
    dispatch({ type: "draftSaved", draftId: result.data.id });
    toast("Draft saved. Resume it any time from your library.", { action: { label: "Library", href: "/library?tab=drafts" } });
  });

  const requestSaveScent = useAuthedAction<MixerSnapshot>(PENDING.saveScent, async (snapshot) => {
    dispatch({ type: "restore", snapshot });
    setBusy("save");
    const id = await persistScent(snapshot);
    setBusy(null);
    if (id) toast("Saved to your library.", { action: { label: "View library", href: "/library" } });
  });

  const requestSaveThenList = useAuthedAction<MixerSnapshot>(PENDING.saveThenList, async (snapshot) => {
    dispatch({ type: "restore", snapshot });
    setBusy("list");
    const id = await persistScent(snapshot);
    if (id) router.push(`/marketplace/list?scent=${id}`);
    else setBusy(null);
  });

  function handleAddToCart() {
    const name = validName(state.name);
    if (!name || !bottle || priceKobo === null) return;
    addToCart({
      type: "custom_scent",
      name,
      formula,
      bottleOptionId: bottle.id,
      bottleLabel: bottleLabel(bottle),
      colors: NOTE_TIERS.map((t) => mixColors(layers[t]) ?? "#000000"),
      displayPriceKobo: priceKobo,
    });
    toast(`${name} added to your cart.`, { action: { label: "View cart", href: "/cart" } });
  }

  const tier = isTierStep(state.step) ? state.step : null;
  const tierIngredients = tier ? catalog.ingredients.filter((i) => i.noteTier === tier) : [];
  const pourItems = (tiers: readonly NoteTier[]) =>
    tiers.flatMap((t) =>
      state.selections[t].flatMap((id) => {
        const ingredient = byId.get(id);
        return ingredient ? [{ ingredient, amount: state.amounts[id] ?? 0 }] : [];
      }),
    );
  const pickedIngredient = picked ? byId.get(picked) ?? null : null;
  const canPourPicked = Boolean(tier && picked && !pourBlocker(state, tier, picked));
  const nextBlocker = tier ? tierBlocker(state, tier) : null;

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        stopDragPour();
        setDragging(null);
      }}
    >
      <div className="mx-auto grid w-full max-w-7xl flex-1 lg:grid-cols-[1fr_340px]">
        <section
          ref={sectionRef}
          className="order-2 scroll-mt-56 px-4 py-8 sm:px-8 lg:order-1 lg:scroll-mt-16 lg:border-r lg:border-line-soft lg:py-10"
        >
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <ol className="flex gap-2" aria-label="Mixer steps">
              {MIXER_STEPS.map((step, i) => (
                <li key={step}>
                  <button
                    type="button"
                    onClick={() => go(step)}
                    disabled={!canVisit(state, step)}
                    aria-current={state.step === step ? "step" : undefined}
                    aria-label={`Step ${i + 1}: ${step === "preview" ? "Name & preview" : `${TIER_LABELS[step]} notes`}`}
                    className={cn(
                      "block h-1 w-10 transition-colors disabled:cursor-not-allowed",
                      i === stepIndex ? "bg-gold" : i < stepIndex ? "bg-gold-dim" : "bg-line",
                    )}
                  />
                </li>
              ))}
            </ol>
            {formula.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                pending={busy === "draft"}
                onClick={() => requestSaveDraft(snapshotOf(state))}
              >
                Save draft
              </Button>
            )}
          </div>

          {initialNotice && <Notice className="mb-6">{initialNotice}</Notice>}

          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={state.step}
              custom={direction}
              initial={reduceMotion ? false : { opacity: 0, x: 40 * direction }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -40 * direction }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              <p className="mb-2 font-serif text-[0.7rem] uppercase tracking-display text-gold">
                Step {stepIndex + 1} of 4
              </p>
              <h1 ref={headingRef} tabIndex={-1} className="mb-2 font-serif text-3xl text-cream focus:outline-none">
                {tier ? STEP_COPY[tier].heading : "Name & Preview"}
              </h1>

              {tier ? (
                <>
                  <p className="mb-2 text-sm text-muted">{STEP_COPY[tier].sub}</p>
                  <p className="mb-8 text-sm text-muted">
                    Tap a vial to pick it up, then tap the bottle to pour {POUR_STEP_PCT}% at a time. Hold the bottle to keep
                    pouring<span className="hidden lg:inline"> (or drag a vial onto it)</span>. Suggested: about {shares[tier]}%{" "}
                    {TIER_LABELS[tier].toLowerCase()} notes.
                  </p>
                  <div className="mb-6 grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-6">
                    {tierIngredients.map((ingredient) => (
                      <IngredientVial
                        key={ingredient.id}
                        ingredient={ingredient}
                        amount={state.amounts[ingredient.id] ?? 0}
                        picked={picked === ingredient.id}
                        blocked={pourBlocker(state, tier, ingredient.id)}
                        onPick={() => pick(tier, ingredient.id)}
                      />
                    ))}
                  </div>
                  {tierIngredients.length === 0 && (
                    <Notice className="mb-6">No {TIER_LABELS[tier].toLowerCase()} notes are available right now.</Notice>
                  )}
                  <div className="border border-dashed border-line px-4 py-4">
                    <p className="mb-3 text-center font-serif text-[0.7rem] uppercase tracking-label text-muted">
                      {TIER_LABELS[tier]} notes in your bottle · {tierPct(state, tier)}%
                    </p>
                    {state.selections[tier].length === 0 ? (
                      <p className="text-center text-xs text-faint">Nothing poured yet.</p>
                    ) : (
                      <PourList
                        items={pourItems([tier])}
                        pourBlocker={(id) => pourBlocker(state, tier, id)}
                        onPour={(id) => pourInto(tier, id)}
                        onPourBack={(id) => pourBack(tier, id)}
                        onRemove={(id) => remove(tier, id)}
                      />
                    )}
                  </div>
                  {tierMessage && <p className="mt-3 text-sm text-danger" role="alert">{tierMessage}</p>}
                  <div className="mt-8 flex flex-wrap items-center gap-4">
                    {stepIndex > 0 && (
                      <Button variant="ghost" onClick={() => go(MIXER_STEPS[stepIndex - 1])}>
                        ← Back
                      </Button>
                    )}
                    <Button onClick={() => go(MIXER_STEPS[stepIndex + 1])} disabled={nextBlocker !== null}>
                      Next →
                    </Button>
                    {nextBlocker && <p className="text-xs text-muted">{nextBlocker}</p>}
                  </div>
                </>
              ) : (
                <MixerPreview
                  state={state}
                  layers={layers}
                  segments={segments}
                  shares={shares}
                  pourItems={pourItems}
                  pourBlocker={(t, id) => pourBlocker(state, t, id)}
                  onPour={pourInto}
                  onPourBack={pourBack}
                  onRemove={remove}
                  bottleOptions={catalog.bottleOptions}
                  priceKobo={priceKobo}
                  nameError={nameError}
                  busy={busy}
                  onNameChange={(name) => {
                    setNameError(null);
                    dispatch({ type: "setName", name });
                  }}
                  onBottleChange={(id) => dispatch({ type: "setBottleOption", bottleOptionId: id })}
                  onBack={() => go("top")}
                  onAddToCart={handleAddToCart}
                  onSave={() => validName(state.name) && requestSaveScent(snapshotOf(state))}
                  onList={() => validName(state.name) && requestSaveThenList(snapshotOf(state))}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </section>

        {/* On phones the bottle stays pinned under the header while the vials scroll. */}
        <aside className="sticky top-16 z-20 order-1 border-b border-line-soft bg-ink px-4 py-3 sm:px-8 lg:static lg:order-2 lg:border-b-0 lg:bg-transparent lg:px-6 lg:py-10">
          <div className="flex items-center gap-4 lg:sticky lg:top-24 lg:block">
            <p className="hidden text-center font-serif text-[0.7rem] uppercase tracking-label text-muted lg:block">Your blend</p>
            <div className="w-20 shrink-0 lg:my-4 lg:w-auto">
              <PourTarget
                pickedName={tier ? pickedIngredient?.name ?? null : null}
                canPour={canPourPicked}
                onPour={() => tier && picked && pourRef.current(tier, picked)}
              >
                <BottleVisual
                  layers={layers}
                  shares={shares}
                  segments={segments}
                  guides={tier ? guides : []}
                  pour={pour}
                  className="mx-auto h-32 lg:h-72"
                />
              </PourTarget>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-serif text-[0.7rem] uppercase tracking-label text-gold lg:text-center" aria-live="polite">
                {filled}% filled
              </p>
              <p className="mt-1 text-xs text-muted lg:mb-4 lg:text-center" aria-live="polite">
                {tier
                  ? pickedIngredient
                    ? canPourPicked
                      ? `Tap the bottle to pour ${pickedIngredient.name}`
                      : pourBlocker(state, tier, pickedIngredient.id)
                    : filled === 100
                      ? "The bottle is full."
                      : "Pick a vial, then tap the bottle."
                  : (blendBlocker(state) ?? "Your blend is ready.")}
              </p>
              <dl className="hidden divide-y divide-line-soft text-xs lg:block">
                {NOTE_TIERS.map((t) => (
                  <div key={t} className="flex justify-between gap-4 py-2.5">
                    <dt className="font-serif uppercase tracking-label text-gold">
                      {TIER_LABELS[t]} <span className="text-muted">{tierPct(state, t)}%</span>
                    </dt>
                    <dd className="text-right text-muted">
                      {state.selections[t]
                        .map((id) => byId.get(id) && `${byId.get(id)!.name} ${state.amounts[id] ?? 0}%`)
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </aside>
      </div>
      <DragOverlay dropAnimation={null}>{dragging && <IngredientDragPreview ingredient={dragging} />}</DragOverlay>
    </DndContext>
  );
}
