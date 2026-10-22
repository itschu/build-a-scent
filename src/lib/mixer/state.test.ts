import { describe, expect, it } from "vitest";
import {
  blendPct,
  defaultAmounts,
  formulaFromSelections,
  initialMixerState,
  isComplete,
  isSavedUnchanged,
  mixerReducer,
  pourBlocker,
  snapshotOf,
  tierBlocker,
  type MixerAction,
  type MixerState,
} from "./state";

type Tier = "base" | "heart" | "top";
const run = (actions: MixerAction[], state: MixerState = initialMixerState()) => actions.reduce(mixerReducer, state);
const pour = (tier: Tier, id: string, times = 1): MixerAction[] =>
  Array.from({ length: times }, () => ({ type: "pour" as const, tier, ingredientId: id }));
const pourBack = (tier: Tier, id: string): MixerAction => ({ type: "pourBack", tier, ingredientId: id });

/** base a 40%, heart b 35%, top c 25%: a full, valid bottle. */
const fullBlend = (): MixerAction[] => [
  ...pour("base", "a", 8),
  { type: "next" },
  ...pour("heart", "b", 7),
  { type: "next" },
  ...pour("top", "c", 5),
  { type: "next" },
];

describe("mixer pouring", () => {
  it("pours 5% measures and allows 1–3 ingredients per tier", () => {
    const state = run([...pour("base", "a", 2), ...pour("base", "b"), ...pour("base", "c"), ...pour("base", "d")]);
    expect(state.selections.base).toEqual(["a", "b", "c"]);
    expect(state.amounts).toEqual({ a: 10, b: 5, c: 5 });
    expect(pourBlocker(state, "base", "d")).toMatch(/up to 3/);
  });

  it("caps a tier at 70% of the blend", () => {
    const state = run(pour("base", "a", 20));
    expect(state.amounts.a).toBe(70);
    expect(pourBlocker(state, "base", "a")).toMatch(/at most 70%/);
  });

  it("keeps room for the other tiers' minimums so the bottle can always be finished", () => {
    // base 70% + heart 20% leaves 10%, reserved for the top notes.
    const state = run([...pour("base", "a", 14), ...pour("heart", "b", 10)]);
    expect(state.amounts.b).toBe(20);
    expect(pourBlocker(state, "heart", "b")).toMatch(/saved for your other notes/);
    expect(pourBlocker(state, "top", "c")).toBeNull();
  });

  it("pours back a measure at a time and removes an ingredient at zero", () => {
    let state = run([...pour("top", "x", 2), pourBack("top", "x")]);
    expect(state.amounts.x).toBe(5);
    state = run([pourBack("top", "x")], state);
    expect(state.selections.top).toEqual([]);
    expect(state.amounts).toEqual({});
  });

  it("toggle removes an already poured ingredient entirely", () => {
    const state = run([...pour("top", "x", 3), { type: "toggle", tier: "top", ingredientId: "x" }]);
    expect(state.selections.top).toEqual([]);
    expect(state.amounts).toEqual({});
  });
});

describe("mixer steps", () => {
  it("needs at least 10% of a tier before moving on", () => {
    let state = run([...pour("base", "a"), { type: "next" }]);
    expect(state.step).toBe("base");
    expect(tierBlocker(state, "base")).toMatch(/at least 10%/);
    state = run([...pour("base", "a"), { type: "next" }], state);
    expect(state.step).toBe("heart");
  });

  it("makes earlier tiers leave no more than the later ones can hold", () => {
    // base 10% + heart 10%: the top notes could only add 70%, so 10% more is needed first.
    const state = run([...pour("base", "a", 2), { type: "next" }, ...pour("heart", "b", 2)]);
    expect(tierBlocker(state, "heart")).toMatch(/Pour 10% more/);
  });

  it("needs a full bottle to reach the preview, and builds a formula with amounts", () => {
    const short = run([...fullBlend().slice(0, -1), pourBack("top", "c"), { type: "next" }]);
    expect(short.step).toBe("top");
    expect(tierBlocker(short, "top")).toBe("Fill the bottle: 5% left to pour.");

    const state = run(fullBlend());
    expect(state.step).toBe("preview");
    expect(blendPct(state)).toBe(100);
    expect(isComplete(state)).toBe(true);
    expect(formulaFromSelections(state.selections, state.amounts)).toEqual([
      { ingredientId: "a", tier: "base", pct: 40 },
      { ingredientId: "b", tier: "heart", pct: 35 },
      { ingredientId: "c", tier: "top", pct: 25 },
    ]);
  });

  it("restores a snapshot to the furthest step it can reach", () => {
    const saved = snapshotOf(run([...pour("base", "a", 2), { type: "next" }]));
    expect(run([{ type: "restore", snapshot: saved }]).step).toBe("heart");
    const tooFar = { ...saved, step: "preview" as const };
    expect(run([{ type: "restore", snapshot: tooFar }]).step).toBe("heart");
  });

  it("gives ingredients restored without amounts a single measure", () => {
    const saved = { ...snapshotOf(initialMixerState()), selections: { base: ["a"], heart: [], top: [] }, amounts: {} };
    expect(run([{ type: "restore", snapshot: saved }]).amounts).toEqual({ a: 5 });
  });

  it("tracks whether the saved scent still matches the blend", () => {
    let state = run([...pour("base", "a"), { type: "draftSaved", draftId: "d1" }, { type: "scentSaved", scentId: "s1" }]);
    expect(isSavedUnchanged(state)).toBe(true);
    expect(state.draftId).toBeNull();
    state = run(pour("base", "a"), state);
    expect(isSavedUnchanged(state)).toBe(false);
  });
});

describe("defaultAmounts", () => {
  it("splits each tier's platform share into whole measures", () => {
    const amounts = defaultAmounts({ base: ["a", "b"], heart: ["c"], top: ["d", "e", "f"] }, { base: 40, heart: 35, top: 25 });
    expect(amounts).toEqual({ a: 20, b: 20, c: 35, d: 10, e: 10, f: 5 });
  });

  it("settles rounding so a complete blend fills the bottle exactly", () => {
    const selections = { base: ["a"], heart: ["b"], top: ["c"] };
    const amounts = defaultAmounts(selections, { base: 33, heart: 33, top: 34 });
    expect(Object.values(amounts).reduce((a, b) => a + b, 0)).toBe(100);
    expect(isComplete({ selections, amounts })).toBe(true);
  });
});
