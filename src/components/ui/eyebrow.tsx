import type { ReactNode } from "react";

/** Small gold uppercase label used above headings. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="mb-2 font-serif text-[0.7rem] uppercase tracking-display text-gold">{children}</p>;
}
