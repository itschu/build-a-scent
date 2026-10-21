"use client";

import { useEffect } from "react";
import { useCartStore } from "@/lib/cart/store";

/** Loads the persisted cart after the first render so server and client HTML match. */
export function CartHydrator() {
  useEffect(() => {
    void useCartStore.persist.rehydrate();
  }, []);
  return null;
}
