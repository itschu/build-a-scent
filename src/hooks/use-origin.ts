"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** The site origin in the browser; empty during server rendering and hydration. */
export function useOrigin(): string {
  return useSyncExternalStore(
    subscribe,
    () => window.location.origin,
    () => "",
  );
}
