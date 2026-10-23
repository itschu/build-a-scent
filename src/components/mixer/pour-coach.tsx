"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { POUR_STEP_PCT } from "@/lib/domain";
import { VialGlyph } from "./ingredient-vial";

type Box = { x: number; y: number; width: number; height: number };

const GHOST = { width: 36, height: 80 };
const CARD_SPACE = 230;

function boxOf(el: Element): Box {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, width: r.width, height: r.height };
}

/**
 * A short demo of pouring, shown on a first visit: the bottle is spotlit and a ghost vial
 * glides from the first ingredient into it. Any tap, Escape or "Got it" closes it.
 */
export function PourCoach({
  source,
  target,
  color,
  onClose,
}: {
  source: Element;
  target: Element;
  color: string;
  onClose: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const titleId = useId();
  // Only ever rendered in the browser (opened from an effect or a click), so window is safe here.
  const [boxes, setBoxes] = useState(() => ({ from: boxOf(source), to: boxOf(target) }));
  const [touch] = useState(() => window.matchMedia("(pointer: coarse)").matches);

  useEffect(() => {
    const measure = () => setBoxes({ from: boxOf(source), to: boxOf(target) });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("resize", measure);
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [source, target, onClose]);

  const { from, to } = boxes;
  // Start from the vial (kept clear of the instructions card) and end over the bottle's neck.
  const start = {
    x: from.x + from.width / 2 - GHOST.width / 2,
    y: Math.min(from.y + 8, window.innerHeight - CARD_SPACE - GHOST.height),
  };
  const end = { x: to.x + to.width / 2 - GHOST.width / 2 - 14, y: to.y + to.height * 0.1 };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-[60] cursor-pointer"
      onClick={onClose}
    >
      {/* Spotlight on the bottle: everything else is dimmed by the shadow. */}
      <div
        className="pointer-events-none fixed rounded-3xl ring-1 ring-gold shadow-[0_0_0_9999px_rgba(0,0,0,0.72)]"
        style={{ left: to.x - 6, top: to.y - 6, width: to.width + 12, height: to.height + 12 }}
        aria-hidden
      />

      <motion.div
        className="pointer-events-none fixed left-0 top-0"
        style={{ width: GHOST.width, height: GHOST.height }}
        initial={false}
        animate={
          reduceMotion
            ? { x: end.x, y: end.y, rotate: -30, opacity: 1 }
            : {
                x: [start.x, start.x, end.x, end.x, end.x],
                y: [start.y, start.y - 18, end.y, end.y, end.y],
                rotate: [0, 0, 0, -38, -38],
                opacity: [0, 1, 1, 1, 0],
              }
        }
        transition={
          reduceMotion
            ? { duration: 0 }
            : { duration: 2.6, times: [0, 0.15, 0.55, 0.72, 1], ease: "easeInOut", repeat: Infinity, repeatDelay: 0.5 }
        }
        aria-hidden
      >
        <VialGlyph color={color} active className="h-20 w-9" />
        {/* The fingertip (or pointer) carrying the vial. */}
        <span className="absolute left-1/2 top-[70%] size-9 -translate-x-1/2 rounded-full border-2 border-cream/80 bg-cream/20" />
      </motion.div>

      <div
        className="fixed inset-x-4 bottom-6 mx-auto max-w-sm border border-gold/60 bg-surface p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p id={titleId} className="mb-2 font-serif text-[0.75rem] uppercase tracking-label text-gold">
          Pour your blend
        </p>
        <p className="mb-4 text-sm text-champagne">
          {touch ? "Press and drag" : "Drag"} a vial into the bottle to pour it in. Keep holding it over the bottle to pour more,
          or just tap a vial to add {POUR_STEP_PCT}%.
        </p>
        <Button size="sm" onClick={onClose} autoFocus>
          Got it
        </Button>
      </div>
    </div>,
    document.body,
  );
}
