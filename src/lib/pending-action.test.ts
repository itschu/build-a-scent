import { describe, expect, it } from "vitest";
import {
  PENDING_ACTION_TTL_MS,
  peekPendingAction,
  savePendingAction,
  takePendingAction,
} from "./pending-action";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

describe("pending actions", () => {
  it("runs once: take removes the action", () => {
    const storage = memoryStorage();
    savePendingAction(storage, { kind: "save_scent", payload: { name: "Midnight Bloom" }, returnTo: "/build" });
    expect(takePendingAction(storage, "save_scent")?.payload).toEqual({ name: "Midnight Bloom" });
    expect(takePendingAction(storage, "save_scent")).toBeNull();
  });

  it("leaves an action of another kind for its own handler", () => {
    const storage = memoryStorage();
    savePendingAction(storage, { kind: "save_then_list", payload: null, returnTo: "/build" });
    expect(takePendingAction(storage, "save_draft")).toBeNull();
    expect(peekPendingAction(storage)?.kind).toBe("save_then_list");
  });

  it("expires stale or corrupt actions", () => {
    const storage = memoryStorage();
    savePendingAction(storage, { kind: "save_draft", payload: null, returnTo: "/" }, 0);
    expect(peekPendingAction(storage, PENDING_ACTION_TTL_MS + 1)).toBeNull();
    storage.setItem("bas:pending-action", "{not json");
    expect(peekPendingAction(storage)).toBeNull();
  });
});
