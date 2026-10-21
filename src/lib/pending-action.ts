// An action a guest started before signing in (save draft, save scent, save-then-list).
// It is kept in sessionStorage so it survives the full-page Google OAuth redirect.

export type PendingAction = {
  kind: string;
  payload: unknown;
  /** Where the user should land after authenticating. */
  returnTo: string;
  createdAt: number;
};

export const PENDING_ACTION_KEY = "bas:pending-action";
export const PENDING_ACTION_TTL_MS = 30 * 60 * 1000;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function savePendingAction(storage: StorageLike, action: Omit<PendingAction, "createdAt">, now = Date.now()) {
  storage.setItem(PENDING_ACTION_KEY, JSON.stringify({ ...action, createdAt: now }));
}

export function peekPendingAction(storage: StorageLike, now = Date.now()): PendingAction | null {
  const raw = storage.getItem(PENDING_ACTION_KEY);
  if (!raw) return null;
  try {
    const action = JSON.parse(raw) as PendingAction;
    if (typeof action.kind !== "string" || now - action.createdAt > PENDING_ACTION_TTL_MS) {
      storage.removeItem(PENDING_ACTION_KEY);
      return null;
    }
    return action;
  } catch {
    storage.removeItem(PENDING_ACTION_KEY);
    return null;
  }
}

/** Removes and returns the pending action if it has the given kind, so it runs at most once. */
export function takePendingAction(storage: StorageLike, kind: string, now = Date.now()): PendingAction | null {
  const action = peekPendingAction(storage, now);
  if (!action || action.kind !== kind) return null;
  storage.removeItem(PENDING_ACTION_KEY);
  return action;
}

export function clearPendingAction(storage: StorageLike) {
  storage.removeItem(PENDING_ACTION_KEY);
}
