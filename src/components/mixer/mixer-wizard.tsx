"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { saveDraftAction, saveScentAction } from "@/app/(public)/build/actions";
import { useAuthedAction } from "@/components/auth/auth-gate";
import { BottleVisual, layersFrom } from "@/components/scent/bottle-visual";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { toast } from "@/components/ui/toast";
import { useCartStore } from "@/lib/cart/store";
import { cn } from "@/lib/cn";
import { MAX_INGREDIENTS_PER_TIER, MIXER_STEPS, NOTE_TIERS, type MixerStep, type NoteTier } from "@/lib/domain";
import { TIER_LABELS, bottleLabel } from "@/lib/labels";
import {
  canVisit,
  formulaFromSelections,
  initialMixerState,
  isComplete,
  isSavedUnchanged,
  isTierStep,
  mixerReducer,
  snapshotOf,
  type MixerSnapshot,
} from "@/lib/mixer/state";
import { mixColors } from "@/lib/color";
import { blendPriceKobo } from "@/lib/pricing";
import { tierSharesFrom } from "@/lib/settings";
import { scentNameSchema } from "@/lib/validation/scent";
import type { MixerCatalog } from "@/server/cached";
import type { CatalogIngredient } from "@/server/dal/catalog";
import { defaultBottleOptionId } from "./bottle-option-picker";
import { BottleDropZone, BOTTLE_DROP_ID, DroppableBottle } from "./drop-zone";
import { IngredientCard, IngredientDragPreview } from "./ingredient-card";
import { MixerPreview } from "./mixer-preview";

const STEP_COPY: Record<NoteTier, { heading: string; sub: string }> = {
  base: { heading: "Base Notes", sub: "Choose 1–3 ingredients that anchor your scent and linger longest." },
  heart: { heading: "Heart Notes", sub: "Choose 1–3 ingredients that form the soul of your scent." },
  top: { heading: "Top Notes", sub: "Choose 1–3 ingredients for the bright first impression." },
};

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
  const headingRef = useRef<HTMLHeadingElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);

  const byId = useMemo(() => new Map(catalog.ingredients.map((i) => [i.id, i])), [catalog.ingredients]);
  const shares = tierSharesFrom(catalog.settings);
  const layers = layersFrom(state.selections, (id) => byId.get(id)?.colorHex);
  const stepIndex = MIXER_STEPS.indexOf(state.step);
  const bottle = catalog.bottleOptions.find((o) => o.id === state.bottleOptionId) ?? null;
  const formula = formulaFromSelections(state.selections);
  const complete = isComplete(state.selections);
  const priceKobo = complete && bottle ? blendPriceKobo(formula, byId, bottle, shares) : null;

  // On step change, bring the new step into view and move focus to its heading.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const section = sectionRef.current;
    // 64px is the sticky site header.
    if (section && section.getBoundingClientRect().top < 64) {
      section.scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" });
    }
    headingRef.current?.focus({ preventScroll: true });
  }, [state.step, reduceMotion]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
  );

  function add(tier: NoteTier, ingredientId: string) {
    if (state.selections[tier].length >= MAX_INGREDIENTS_PER_TIER) {
      setTierMessage(`You can choose up to ${MAX_INGREDIENTS_PER_TIER} ${TIER_LABELS[tier].toLowerCase()} notes.`);
      return;
    }
    setTierMessage(null);
    dispatch({ type: "add", tier, ingredientId });
  }

  function onDragStart(event: DragStartEvent) {
    setDragging(byId.get(event.active.data.current?.ingredientId as string) ?? null);
  }

  function onDragEnd(event: DragEndEvent) {
    setDragging(null);
    const ingredientId = event.active.data.current?.ingredientId as string | undefined;
    if (!ingredientId || !event.over || !String(event.over.id).startsWith(BOTTLE_DROP_ID)) return;
    const tier = byId.get(ingredientId)?.noteTier;
    if (tier && tier === state.step) add(tier, ingredientId);
  }

  function go(step: MixerStep) {
    setDirection(MIXER_STEPS.indexOf(step) >= stepIndex ? 1 : -1);
    setTierMessage(null);
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
      formula: formulaFromSelections(snapshot.selections),
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
      formula: formulaFromSelections(snapshot.selections),
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
  const selectedInTier = tier ? state.selections[tier].map((id) => byId.get(id)).filter((i): i is CatalogIngredient => Boolean(i)) : [];

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
      <div className="mx-auto grid w-full max-w-7xl flex-1 lg:grid-cols-[1fr_340px]">
        <section
          ref={sectionRef}
          className="order-2 scroll-mt-16 px-4 py-8 sm:px-8 lg:order-1 lg:border-r lg:border-line-soft lg:py-10"
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
                  <p className="mb-8 text-sm text-muted">{STEP_COPY[tier].sub} Drag them into the bottle or tap to add.</p>
                  <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                    {tierIngredients.map((ingredient) => {
                      const selected = state.selections[tier].includes(ingredient.id);
                      return (
                        <IngredientCard
                          key={ingredient.id}
                          ingredient={ingredient}
                          selected={selected}
                          full={state.selections[tier].length >= MAX_INGREDIENTS_PER_TIER}
                          onToggle={() =>
                            selected ? dispatch({ type: "remove", tier, ingredientId: ingredient.id }) : add(tier, ingredient.id)
                          }
                        />
                      );
                    })}
                  </div>
                  {tierIngredients.length === 0 && (
                    <Notice className="mb-6">No {TIER_LABELS[tier].toLowerCase()} notes are available right now.</Notice>
                  )}
                  <BottleDropZone
                    selected={selectedInTier}
                    onRemove={(id) => dispatch({ type: "remove", tier, ingredientId: id })}
                  />
                  {tierMessage && <p className="mt-3 text-sm text-danger" role="alert">{tierMessage}</p>}
                  <div className="mt-8 flex items-center gap-4">
                    {stepIndex > 0 && (
                      <Button variant="ghost" onClick={() => go(MIXER_STEPS[stepIndex - 1])}>
                        ← Back
                      </Button>
                    )}
                    <Button onClick={() => go(MIXER_STEPS[stepIndex + 1])} disabled={state.selections[tier].length === 0}>
                      Next →
                    </Button>
                  </div>
                </>
              ) : (
                <MixerPreview
                  state={state}
                  byId={byId}
                  layers={layers}
                  shares={shares}
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

        <aside className="order-1 border-b border-line-soft px-4 py-6 sm:px-8 lg:order-2 lg:border-b-0 lg:px-6 lg:py-10">
          <div className="lg:sticky lg:top-24">
            <p className="text-center font-serif text-[0.7rem] uppercase tracking-label text-muted">Your blend</p>
            <DroppableBottle>
              <BottleVisual layers={layers} shares={shares} className="mx-auto my-4 h-44 lg:h-72" />
            </DroppableBottle>
            <dl className="hidden divide-y divide-line-soft text-xs sm:block">
              {NOTE_TIERS.map((t) => (
                <div key={t} className="flex justify-between gap-4 py-2.5">
                  <dt className="font-serif uppercase tracking-label text-gold">{TIER_LABELS[t]}</dt>
                  <dd className="text-right text-muted">
                    {state.selections[t].map((id) => byId.get(id)?.name).filter(Boolean).join(", ") || "—"}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </aside>
      </div>
      <DragOverlay dropAnimation={null}>{dragging && <IngredientDragPreview ingredient={dragging} />}</DragOverlay>
    </DndContext>
  );
}
