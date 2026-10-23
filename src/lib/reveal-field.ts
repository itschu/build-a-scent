/**
 * Brings a form control with an error into view and focuses it, so a failed submit always
 * shows the user what to fix even when they've scrolled away from it.
 */
export function revealField(el: HTMLElement | null | undefined): void {
  if (!el) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Centred, so it clears the sticky header (and the pinned bottle in the mixer on phones).
  el.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
  el.focus({ preventScroll: true });
}
