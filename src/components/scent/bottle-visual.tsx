"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useId } from "react";
import { NOTE_TIERS, type NoteTier } from "@/lib/domain";

export type BottleLayers = Record<NoteTier, string[]>;

const DEFAULT_SHARES: Record<NoteTier, number> = { base: 40, heart: 35, top: 25 };

// Liquid area inside the bottle body (viewBox units).
const BODY = { x: 30, top: 110, bottom: 300, width: 140 };
const FILL_HEIGHT = BODY.bottom - BODY.top;

/**
 * The animated bottle: one liquid layer per note tier (base at the bottom), each coloured by
 * its ingredients and sized by the tier's share of the blend. Layers pour in as they fill.
 */
export function BottleVisual({
  layers,
  shares = DEFAULT_SHARES,
  className,
  label,
}: {
  layers: BottleLayers;
  shares?: Record<NoteTier, number>;
  className?: string;
  label?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const reduceMotion = useReducedMotion();
  const rects = stackLayers(layers, shares);

  return (
    <svg viewBox="0 0 200 320" className={className} role="img" aria-label={label ?? "Your blend"}>
      <defs>
        <clipPath id={`body-${uid}`}>
          <rect x={BODY.x} y={BODY.top} width={BODY.width} height={FILL_HEIGHT} rx="18" />
        </clipPath>
        <linearGradient id={`glass-${uid}`} x1="0" x2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.1" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0.02" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.08" />
        </linearGradient>
        {rects.map(({ tier, colors }) => (
          <linearGradient key={tier} id={`${tier}-${uid}`} x1="0" x2="1">
            {(colors.length > 0 ? colors : ["#000000"]).map((color, i, all) => (
              <stop key={`${color}-${i}`} offset={all.length === 1 ? 0 : i / (all.length - 1)} stopColor={color} />
            ))}
          </linearGradient>
        ))}
      </defs>

      <rect x="78" y="40" width="44" height="34" rx="4" fill="#c9a84c" />
      <rect x="86" y="74" width="28" height="38" fill="#1c1c1c" stroke="#5a4a2a" />
      <rect x={BODY.x} y={BODY.top} width={BODY.width} height={FILL_HEIGHT} rx="18" fill="#0d0d0d" />

      <g clipPath={`url(#body-${uid})`}>
        {rects.map(({ tier, y, height }) => (
          <motion.rect
            key={tier}
            x={BODY.x}
            width={BODY.width}
            fill={`url(#${tier}-${uid})`}
            opacity={0.9}
            initial={false}
            animate={{ y, height }}
            transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 60, damping: 14 }}
          />
        ))}
      </g>

      <rect
        x={BODY.x}
        y={BODY.top}
        width={BODY.width}
        height={FILL_HEIGHT}
        rx="18"
        fill={`url(#glass-${uid})`}
        stroke="#3a3a3a"
        strokeWidth="2"
      />
      <rect x={BODY.x + 14} y={BODY.top + 14} width="8" height={FILL_HEIGHT - 40} rx="4" fill="#fff" opacity="0.07" />
    </svg>
  );
}

/** Positions each tier's liquid layer, stacking base at the bottom of the bottle. */
function stackLayers(layers: BottleLayers, shares: Record<NoteTier, number>) {
  const heights = NOTE_TIERS.map((tier) => (layers[tier].length > 0 ? (FILL_HEIGHT * shares[tier]) / 100 : 0));
  return NOTE_TIERS.map((tier, i) => {
    const below = heights.slice(0, i + 1).reduce((a, b) => a + b, 0);
    return { tier, colors: layers[tier], y: BODY.bottom - below, height: heights[i] };
  });
}

/** Builds layer colours from a formula's ingredients. */
export function layersFrom(
  selections: Record<NoteTier, string[]>,
  colorOf: (ingredientId: string) => string | undefined,
): BottleLayers {
  return {
    base: selections.base.map(colorOf).filter((c): c is string => Boolean(c)),
    heart: selections.heart.map(colorOf).filter((c): c is string => Boolean(c)),
    top: selections.top.map(colorOf).filter((c): c is string => Boolean(c)),
  };
}
