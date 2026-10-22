// The mixer wizard's state machine (Core Flows, Flow 2): base → heart → top → preview.
// Ingredients are "poured" into the bottle one measure (POUR_STEP_PCT of the blend) at a
// time, so the amounts are the proportions of the finished scent.
import {
  MAX_INGREDIENTS_PER_TIER,
  MIXER_STEPS,
  NOTE_TIERS,
  POUR_STEP_PCT,
  TIER_MAX_PCT,
  TIER_MIN_PCT,
  type MixerStep,
  type NoteTier,
} from "@/lib/domain";
import { isProportioned, type Formula } from "@/lib/formula";
import type { TierShares } from "@/lib/pricing";

export type Selections = Record<NoteTier, string[]>;
/** Percent of the blend per selected ingredient ID. */
export type Amounts = Record<string, number>;

export type MixerState = {
  step: MixerStep;
  selections: Selections;
  amounts: Amounts;
  name: string;
  bottleOptionId: string | null;
  /** The draft being edited, so Save Draft updates it instead of creating another. */
  draftId: string | null;
  /** Set in Edit mode: saving creates a new version of this scent. */
  parentScentId: string | null;
  /** The saved scent created from the current blend, to avoid saving duplicates. */
  savedScentId: string | null;
  /** Bumped on every change to the blend; compared with the version last saved. */
  revision: number;
  savedRevision: number | null;
};

/** Everything needed to restore the mixer (e.g. after a sign-in redirect). */
export type MixerSnapshot = Pick<
  MixerState,
  "step" | "selections" | "amounts" | "name" | "bottleOptionId" | "draftId" | "parentScentId"
>;

export type MixerAction =
  | { type: "pour"; tier: NoteTier; ingredientId: string }
  | { type: "pourBack"; tier: NoteTier; ingredientId: string }
  | { type: "add"; tier: NoteTier; ingredientId: string }
  | { type: "remove"; tier: NoteTier; ingredientId: string }
  | { type: "toggle"; tier: NoteTier; ingredientId: string }
  | { type: "next" }
  | { type: "back" }
  | { type: "goTo"; step: MixerStep }
  | { type: "setName"; name: string }
  | { type: "setBottleOption"; bottleOptionId: string }
  | { type: "restore"; snapshot: MixerSnapshot }
  | { type: "draftSaved"; draftId: string }
  | { type: "scentSaved"; scentId: string };

export const emptySelections = (): Selections => ({ base: [], heart: [], top: [] });

export function initialMixerState(overrides: Partial<MixerSnapshot> = {}): MixerState {
  return {
    step: "base",
    selections: emptySelections(),
    amounts: {},
    name: "",
    bottleOptionId: null,
    draftId: null,
    parentScentId: null,
    savedScentId: null,
    revision: 0,
    savedRevision: null,
    ...overrides,
  };
}

type Blend = Pick<MixerState, "selections" | "amounts">;

export function tierPct(blend: Blend, tier: NoteTier): number {
  return blend.selections[tier].reduce((sum, id) => sum + (blend.amounts[id] ?? 0), 0);
}

export function blendPct(blend: Blend): number {
  return NOTE_TIERS.reduce((sum, tier) => sum + tierPct(blend, tier), 0);
}

/**
 * Why one more measure of this ingredient can't be poured, or null if it can. Room is kept
 * for every other tier's minimum, so the bottle can always still be completed.
 */
export function pourBlocker(blend: Blend, tier: NoteTier, ingredientId: string): string | null {
  const selected = blend.selections[tier].includes(ingredientId);
  if (!selected && blend.selections[tier].length >= MAX_INGREDIENTS_PER_TIER) {
    return `You can choose up to ${MAX_INGREDIENTS_PER_TIER} ${tier} notes.`;
  }
  if (tierPct(blend, tier) + POUR_STEP_PCT > TIER_MAX_PCT) {
    return `${capitalize(tier)} notes can be at most ${TIER_MAX_PCT}% of the blend.`;
  }
  const reserved = NOTE_TIERS.filter((t) => t !== tier).reduce(
    (sum, t) => sum + Math.max(0, TIER_MIN_PCT - tierPct(blend, t)),
    0,
  );
  if (blendPct(blend) + POUR_STEP_PCT + reserved > 100) {
    return reserved > 0 ? "The rest of the bottle is saved for your other notes." : "The bottle is full.";
  }
  return null;
}

/**
 * Why the mixer can't move past this tier yet, or null. Each tier needs TIER_MIN_PCT, the
 * tiers still to come must be able to fill the rest (each holds at most TIER_MAX_PCT), and
 * the last tier must fill the bottle.
 */
export function tierBlocker(blend: Blend, tier: NoteTier): string | null {
  if (blend.selections[tier].length === 0) return `Pour at least one ${tier} note.`;
  if (tierPct(blend, tier) < TIER_MIN_PCT) return `${capitalize(tier)} notes need at least ${TIER_MIN_PCT}% of the blend.`;
  const later = NOTE_TIERS.slice(NOTE_TIERS.indexOf(tier) + 1);
  const filledSoFar = NOTE_TIERS.slice(0, NOTE_TIERS.indexOf(tier) + 1).reduce((sum, t) => sum + tierPct(blend, t), 0);
  const missing = 100 - TIER_MAX_PCT * later.length - filledSoFar;
  if (missing > 0) {
    return later.length === 0
      ? `Fill the bottle: ${missing}% left to pour.`
      : `Pour ${missing}% more so the remaining notes can fill the bottle.`;
  }
  return null;
}

/** A step can be visited once every earlier tier is ready. */
export function canVisit(blend: Blend, step: MixerStep): boolean {
  const index = MIXER_STEPS.indexOf(step);
  return NOTE_TIERS.slice(0, index).every((tier) => tierBlocker(blend, tier) === null);
}

/** The first thing stopping the blend from being complete, or null when it's ready. */
export function blendBlocker(blend: Blend): string | null {
  for (const tier of NOTE_TIERS) {
    const blocker = tierBlocker(blend, tier);
    if (blocker) return blocker;
  }
  return null;
}

/** Every tier has ingredients and its minimum, and the bottle is exactly full. */
export function isComplete(blend: Blend): boolean {
  // The top tier's check requires a full bottle, so this also means 100%.
  return blendBlocker(blend) === null;
}

const snapDown = (pct: number) => Math.floor(pct / POUR_STEP_PCT) * POUR_STEP_PCT;

/**
 * Starting amounts for a formula saved before proportions existed: each tier takes its
 * platform share (in whole measures, within the guard rails), split as evenly as possible.
 */
export function defaultAmounts(selections: Selections, shares: TierShares): Amounts {
  const amounts: Amounts = {};
  for (const tier of NOTE_TIERS) {
    const ids = selections[tier];
    if (ids.length === 0) continue;
    const target = Math.min(TIER_MAX_PCT, Math.max(TIER_MIN_PCT, ids.length * POUR_STEP_PCT, snapDown(shares[tier])));
    const measures = target / POUR_STEP_PCT;
    ids.forEach((id, i) => {
      amounts[id] = POUR_STEP_PCT * (Math.floor(measures / ids.length) + (i < measures % ids.length ? 1 : 0));
    });
  }
  // Rounding to whole measures can leave a complete blend off 100%: settle it measure by
  // measure on the ingredients with the most room.
  if (NOTE_TIERS.every((t) => selections[t].length > 0)) {
    const blend = { selections, amounts };
    const tierOf = (id: string) => NOTE_TIERS.find((t) => selections[t].includes(id))!;
    const ids = NOTE_TIERS.flatMap((t) => selections[t]);
    for (let guard = 0; guard < 40 && blendPct(blend) !== 100; guard++) {
      const over = blendPct(blend) > 100;
      const candidate = ids
        .filter((id) =>
          over
            ? amounts[id] > POUR_STEP_PCT && tierPct(blend, tierOf(id)) > TIER_MIN_PCT
            : tierPct(blend, tierOf(id)) < TIER_MAX_PCT,
        )
        .sort((a, b) => (over ? amounts[b] - amounts[a] : amounts[a] - amounts[b]))[0];
      if (!candidate) break;
      amounts[candidate] += over ? -POUR_STEP_PCT : POUR_STEP_PCT;
    }
  }
  return amounts;
}

export function selectionsFromFormula(formula: Formula): Selections {
  const selections = emptySelections();
  for (const entry of formula) {
    if (selections[entry.tier].length < MAX_INGREDIENTS_PER_TIER) selections[entry.tier].push(entry.ingredientId);
  }
  return selections;
}

/** The formula's own amounts, or starting amounts for a formula saved without them. */
export function amountsFromFormula(formula: Formula, shares: TierShares): Amounts {
  if (isProportioned(formula)) return Object.fromEntries(formula.map((e) => [e.ingredientId, e.pct!]));
  return defaultAmounts(selectionsFromFormula(formula), shares);
}

export function formulaFromSelections(selections: Selections, amounts: Amounts): Formula {
  return NOTE_TIERS.flatMap((tier) =>
    selections[tier].map((ingredientId) =>
      amounts[ingredientId] ? { ingredientId, tier, pct: amounts[ingredientId] } : { ingredientId, tier },
    ),
  );
}

export function isTierStep(step: MixerStep): step is NoteTier {
  return step !== "preview";
}

function changed(state: MixerState, patch: Partial<MixerState>): MixerState {
  return { ...state, ...patch, revision: state.revision + 1 };
}

function withoutIngredient(state: MixerState, tier: NoteTier, ingredientId: string): MixerState {
  const amounts = { ...state.amounts };
  delete amounts[ingredientId];
  return changed(state, {
    selections: { ...state.selections, [tier]: state.selections[tier].filter((id) => id !== ingredientId) },
    amounts,
  });
}

export function mixerReducer(state: MixerState, action: MixerAction): MixerState {
  switch (action.type) {
    case "pour": {
      if (pourBlocker(state, action.tier, action.ingredientId)) return state;
      const current = state.selections[action.tier];
      return changed(state, {
        selections: current.includes(action.ingredientId)
          ? state.selections
          : { ...state.selections, [action.tier]: [...current, action.ingredientId] },
        amounts: { ...state.amounts, [action.ingredientId]: (state.amounts[action.ingredientId] ?? 0) + POUR_STEP_PCT },
      });
    }
    case "pourBack": {
      const amount = state.amounts[action.ingredientId];
      if (!state.selections[action.tier].includes(action.ingredientId) || !amount) return state;
      if (amount <= POUR_STEP_PCT) return withoutIngredient(state, action.tier, action.ingredientId);
      return changed(state, { amounts: { ...state.amounts, [action.ingredientId]: amount - POUR_STEP_PCT } });
    }
    case "add":
      return state.selections[action.tier].includes(action.ingredientId) ? state : mixerReducer(state, { ...action, type: "pour" });
    case "remove":
      return state.selections[action.tier].includes(action.ingredientId)
        ? withoutIngredient(state, action.tier, action.ingredientId)
        : state;
    case "toggle":
      return mixerReducer(state, {
        ...action,
        type: state.selections[action.tier].includes(action.ingredientId) ? "remove" : "add",
      });
    case "next": {
      const next = MIXER_STEPS[MIXER_STEPS.indexOf(state.step) + 1];
      return next && canVisit(state, next) ? { ...state, step: next } : state;
    }
    case "back": {
      const previous = MIXER_STEPS[MIXER_STEPS.indexOf(state.step) - 1];
      return previous ? { ...state, step: previous } : state;
    }
    case "goTo":
      return canVisit(state, action.step) ? { ...state, step: action.step } : state;
    case "setName":
      return changed(state, { name: action.name });
    case "setBottleOption":
      return action.bottleOptionId === state.bottleOptionId ? state : changed(state, { bottleOptionId: action.bottleOptionId });
    case "restore": {
      const { snapshot } = action;
      // Keep amounts only for selected ingredients; one restored without an amount (e.g. a
      // snapshot taken before amounts existed) starts at a single measure.
      const selected = NOTE_TIERS.flatMap((t) => snapshot.selections[t]);
      const amounts = Object.fromEntries(selected.map((id) => [id, snapshot.amounts?.[id] || POUR_STEP_PCT]));
      const restored = { ...snapshot, amounts };
      // The furthest reachable step up to the one saved (e.g. the top notes step when a
      // discontinued ingredient left the bottle short).
      const step = MIXER_STEPS.slice(0, MIXER_STEPS.indexOf(snapshot.step) + 1).filter((s) => canVisit(restored, s)).at(-1) ?? "base";
      return { ...initialMixerState(), ...restored, step, revision: state.revision + 1 };
    }
    case "draftSaved":
      return { ...state, draftId: action.draftId };
    case "scentSaved":
      // A finished draft becomes the saved scent, so there's no draft left to update.
      return { ...state, savedScentId: action.scentId, savedRevision: state.revision, draftId: null };
  }
}

export function snapshotOf(state: MixerState): MixerSnapshot {
  const { step, selections, amounts, name, bottleOptionId, draftId, parentScentId } = state;
  return { step, selections, amounts, name, bottleOptionId, draftId, parentScentId };
}

/** True when the current blend is already saved, so Save to Library would duplicate it. */
export function isSavedUnchanged(state: MixerState): boolean {
  return state.savedScentId !== null && state.savedRevision === state.revision;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
