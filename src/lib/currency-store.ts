"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type CurrencyState = { currency: "NGN" | "USD"; toggle: () => void };

/** Display currency. USD is display-only; checkout always charges NGN (Tech Plan, Decision 14). */
export const useCurrencyStore = create<CurrencyState>()(
  persist((set) => ({ currency: "NGN", toggle: () => set((s) => ({ currency: s.currency === "NGN" ? "USD" : "NGN" })) }), {
    name: "bas:currency",
    storage: createJSONStorage(() => localStorage),
  }),
);
