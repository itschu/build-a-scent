"use client";

import { create } from "zustand";

/** Messages from checkout revalidation, shown once on the cart page. */
export const useCartNotices = create<{ notices: string[]; set: (n: string[]) => void; clear: () => void }>((set) => ({
  notices: [],
  set: (notices) => set({ notices }),
  clear: () => set({ notices: [] }),
}));
