"use client";

import { useCallback, useEffect, useRef } from "react";
import { create } from "zustand";
import { useSession } from "@/lib/auth-client";
import { savePendingAction, takePendingAction } from "@/lib/pending-action";

type AuthGateState = {
  isOpen: boolean;
  returnTo: string;
  open: (returnTo: string) => void;
  close: () => void;
};

export const useAuthGateStore = create<AuthGateState>((set) => ({
  isOpen: false,
  returnTo: "/",
  open: (returnTo) => set({ isOpen: true, returnTo }),
  close: () => set({ isOpen: false }),
}));

function currentLocation(): string {
  return window.location.pathname + window.location.search;
}

/**
 * Remembers an action a guest wants to take and opens the auth modal. After sign-in
 * (in the modal, or via the Google redirect) the matching `usePendingAction` handler runs it.
 */
export function requestAuth(kind: string, payload: unknown) {
  const returnTo = currentLocation();
  savePendingAction(window.sessionStorage, { kind, payload, returnTo });
  useAuthGateStore.getState().open(returnTo);
}

/** Runs `handler` once with the saved payload when a signed-in user has a pending `kind` action. */
export function usePendingAction<P>(kind: string, handler: (payload: P) => void) {
  const { data: session } = useSession();
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    if (!session) return;
    const action = takePendingAction(window.sessionStorage, kind);
    if (action) handlerRef.current(action.payload as P);
  }, [session, kind]);
}

/**
 * Wraps an action that needs an account. Signed-in users run it immediately; guests see the
 * auth modal and the action completes automatically after they sign in.
 */
export function useAuthedAction<P>(kind: string, handler: (payload: P) => void) {
  const { data: session } = useSession();
  usePendingAction(kind, handler);
  return useCallback(
    (payload: P) => {
      if (session) handler(payload);
      else requestAuth(kind, payload);
    },
    [session, kind, handler],
  );
}
