"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { addLine, removeLine, updateLineQuantity, type CartLine, type NewCartLine } from "./cart";

type CartState = {
  lines: CartLine[];
  /** False until localStorage has been read, so server and first client render match. */
  hydrated: boolean;
  addItem: (item: NewCartLine, quantity?: number) => void;
  removeItem: (key: string) => void;
  updateQty: (key: string, quantity: number) => void;
  /** Replaces the cart, e.g. with the server's revalidated version at checkout. */
  replaceAll: (lines: CartLine[]) => void;
  clearCart: () => void;
};

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      hydrated: false,
      addItem: (item, quantity = 1) => set((s) => ({ lines: addLine(s.lines, item, quantity) })),
      removeItem: (key) => set((s) => ({ lines: removeLine(s.lines, key) })),
      updateQty: (key, quantity) => set((s) => ({ lines: updateLineQuantity(s.lines, key, quantity) })),
      replaceAll: (lines) => set({ lines }),
      clearCart: () => set({ lines: [] }),
    }),
    {
      name: "bas:cart",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ lines: s.lines }),
      skipHydration: true,
      onRehydrateStorage: () => () => useCartStore.setState({ hydrated: true }),
    },
  ),
);
