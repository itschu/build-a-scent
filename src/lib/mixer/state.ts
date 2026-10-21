// The mixer wizard's state machine (Core Flows, Flow 2): base → heart → top → preview.
import { MAX_INGREDIENTS_PER_TIER, MIXER_STEPS, NOTE_TIERS, type MixerStep, type NoteTier } from "@/lib/domain";
import type { Formula } from "@/lib/formula";

export type Selections = Record<NoteTier, string[]>;

export type MixerState = {
  step: MixerStep;
  selections: Selections;
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
  "step" | "selections" | "name" | "bottleOptionId" | "draftId" | "parentScentId"
>;

export type MixerAction =
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

export function selectionsFromFormula(formula: Formula): Selections {
  const selections = emptySelections();
  for (const entry of formula) {
    if (selections[entry.tier].length < MAX_INGREDIENTS_PER_TIER) selections[entry.tier].push(entry.ingredientId);
  }
  return selections;
}

export function formulaFromSelections(selections: Selections): Formula {
  return NOTE_TIERS.flatMap((tier) => selections[tier].map((ingredientId) => ({ ingredientId, tier })));
}

export function isTierStep(step: MixerStep): step is NoteTier {
  return step !== "preview";
}

/** A step can be visited once every earlier tier has at least one ingredient. */
export function canVisit(state: Pick<MixerState, "selections">, step: MixerStep): boolean {
  const index = MIXER_STEPS.indexOf(step);
  return NOTE_TIERS.slice(0, index).every((tier) => state.selections[tier].length > 0);
}

export function isComplete(selections: Selections): boolean {
  return NOTE_TIERS.every((tier) => selections[tier].length > 0);
}

function changed(state: MixerState, patch: Partial<MixerState>): MixerState {
  return { ...state, ...patch, revision: state.revision + 1 };
}

export function mixerReducer(state: MixerState, action: MixerAction): MixerState {
  switch (action.type) {
    case "add": {
      const current = state.selections[action.tier];
      if (current.includes(action.ingredientId) || current.length >= MAX_INGREDIENTS_PER_TIER) return state;
      return changed(state, { selections: { ...state.selections, [action.tier]: [...current, action.ingredientId] } });
    }
    case "remove": {
      const current = state.selections[action.tier];
      if (!current.includes(action.ingredientId)) return state;
      return changed(state, {
        selections: { ...state.selections, [action.tier]: current.filter((id) => id !== action.ingredientId) },
      });
    }
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
      const step = canVisit(snapshot, snapshot.step) ? snapshot.step : "base";
      return { ...initialMixerState(), ...snapshot, step, revision: state.revision + 1 };
    }
    case "draftSaved":
      return { ...state, draftId: action.draftId };
    case "scentSaved":
      // A finished draft becomes the saved scent, so there's no draft left to update.
      return { ...state, savedScentId: action.scentId, savedRevision: state.revision, draftId: null };
  }
}

export function snapshotOf(state: MixerState): MixerSnapshot {
  const { step, selections, name, bottleOptionId, draftId, parentScentId } = state;
  return { step, selections, name, bottleOptionId, draftId, parentScentId };
}

/** True when the current blend is already saved, so Save to Library would duplicate it. */
export function isSavedUnchanged(state: MixerState): boolean {
  return state.savedScentId !== null && state.savedRevision === state.revision;
}
