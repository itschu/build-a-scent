import { describe, expect, it } from "vitest";
import { formulaFromSelections, initialMixerState, isSavedUnchanged, mixerReducer, snapshotOf, type MixerAction, type MixerState } from "./state";

const run = (actions: MixerAction[], state: MixerState = initialMixerState()) => actions.reduce(mixerReducer, state);
const add = (tier: "base" | "heart" | "top", id: string): MixerAction => ({ type: "add", tier, ingredientId: id });

describe("mixer state", () => {
  it("allows 1–3 ingredients per tier and blocks a fourth", () => {
    const state = run([add("base", "a"), add("base", "b"), add("base", "c"), add("base", "d"), add("base", "a")]);
    expect(state.selections.base).toEqual(["a", "b", "c"]);
  });

  it("only advances once the current tier has an ingredient", () => {
    let state = run([{ type: "next" }]);
    expect(state.step).toBe("base");
    state = run([add("base", "a"), { type: "next" }]);
    expect(state.step).toBe("heart");
    expect(run([{ type: "goTo", step: "preview" }], state).step).toBe("heart");
  });

  it("walks to the preview and builds a formula in tier order", () => {
    const state = run([
      add("base", "a"),
      { type: "next" },
      add("heart", "b"),
      add("heart", "c"),
      { type: "next" },
      add("top", "d"),
      { type: "next" },
    ]);
    expect(state.step).toBe("preview");
    expect(formulaFromSelections(state.selections)).toEqual([
      { ingredientId: "a", tier: "base" },
      { ingredientId: "b", tier: "heart" },
      { ingredientId: "c", tier: "heart" },
      { ingredientId: "d", tier: "top" },
    ]);
  });

  it("toggle removes an already selected ingredient", () => {
    const state = run([add("top", "x"), { type: "toggle", tier: "top", ingredientId: "x" }]);
    expect(state.selections.top).toEqual([]);
  });

  it("restores a snapshot but never to a step that isn't reachable", () => {
    const saved = snapshotOf(run([add("base", "a"), { type: "next" }]));
    expect(run([{ type: "restore", snapshot: saved }]).step).toBe("heart");
    const bogus = { ...saved, step: "preview" as const };
    expect(run([{ type: "restore", snapshot: bogus }]).step).toBe("base");
  });

  it("tracks whether the saved scent still matches the blend", () => {
    let state = run([add("base", "a"), { type: "draftSaved", draftId: "d1" }, { type: "scentSaved", scentId: "s1" }]);
    expect(isSavedUnchanged(state)).toBe(true);
    expect(state.draftId).toBeNull();
    state = run([{ type: "setName", name: "New name" }], state);
    expect(isSavedUnchanged(state)).toBe(false);
  });
});
