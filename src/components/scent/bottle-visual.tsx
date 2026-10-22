"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useId } from "react";
import { NOTE_TIERS, type NoteTier } from "@/lib/domain";

export type BottleLayers = Record<NoteTier, string[]>;

/** One ingredient's liquid in the bottle, listed from the bottom (base) up. */
export type BottleSegment = { id: string; color: string; pct: number };
/** A dashed marker at a cumulative fill level, e.g. where heart notes are suggested to start. */
export type BottleGuide = { pct: number; label: string };

const DEFAULT_SHARES: Record<NoteTier, number> = { base: 40, heart: 35, top: 25 };

// Liquid area inside the bottle body (viewBox units).
const BODY = { x: 30, top: 110, bottom: 300, width: 140 };
const FILL_HEIGHT = BODY.bottom - BODY.top;

/**
 * The animated bottle: one liquid layer per note tier (base at the bottom), each coloured by
 * its ingredients and sized by the tier's share of the blend. Layers pour in as they fill.
 *
 * The mixer passes `segments` instead, to draw every ingredient at its own amount, plus
 * `guides` for the suggested split and `pour` to animate a stream into the bottle.
 */
export function BottleVisual({
  layers,
  shares = DEFAULT_SHARES,
  segments,
  guides = [],
  pour,
  className,
  label,
}: {
  layers: BottleLayers;
  shares?: Record<NoteTier, number>;
  segments?: BottleSegment[];
  guides?: BottleGuide[];
  /** Changing `key` replays the pour animation in `color`. */
  pour?: { key: number; color: string } | null;
  className?: string;
  label?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const reduceMotion = useReducedMotion();
  const rects = stackLayers(layers, shares);
  const stacked = segments ? stackSegments(segments) : [];
  const surfaceY = segments ? BODY.bottom - stacked.reduce((sum, s) => sum + s.height, 0) : BODY.top;

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
        {segments
          ? stacked.map(({ id, color, y, height }) => (
              <motion.rect
                key={id}
                x={BODY.x}
                width={BODY.width}
                fill={color}
                opacity={0.9}
                initial={reduceMotion ? false : { y: BODY.bottom, height: 0 }}
                animate={{ y, height }}
                transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 90, damping: 16 }}
              />
            ))
          : rects.map(({ tier, y, height }) => (
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
        {/* Thin highlights between ingredients, like layers in a sorting tube. */}
        {stacked.slice(1).map(({ id, y, height }) => (
          <motion.line
            key={`edge-${id}`}
            x1={BODY.x}
            x2={BODY.x + BODY.width}
            stroke="#000"
            strokeOpacity={0.35}
            strokeWidth={1}
            initial={false}
            animate={{ y1: y + height, y2: y + height }}
            transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 90, damping: 16 }}
          />
        ))}
      </g>

      {guides.map((guide) => {
        const y = BODY.bottom - (FILL_HEIGHT * guide.pct) / 100;
        return (
          <g key={guide.label} aria-hidden>
            <line x1={BODY.x + 6} x2={BODY.x + BODY.width - 6} y1={y} y2={y} stroke="#c9a84c" strokeOpacity={0.45} strokeDasharray="4 4" />
            <text x={BODY.x + BODY.width - 8} y={y - 4} textAnchor="end" fontSize="9" fill="#c9a84c" fillOpacity={0.7}>
              {guide.label}
            </text>
          </g>
        );
      })}

      {pour && !reduceMotion && (
        <motion.rect
          key={pour.key}
          x={97}
          width={6}
          rx={3}
          fill={pour.color}
          initial={{ y: 0, height: 0, opacity: 0.95 }}
          animate={{ y: [0, 0, surfaceY], height: [0, surfaceY, 0], opacity: [0.95, 0.95, 0] }}
          transition={{ duration: 0.55, times: [0, 0.55, 1], ease: "easeIn" }}
          aria-hidden
        />
      )}

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

/** Positions each ingredient's liquid, stacking from the bottom of the bottle. */
function stackSegments(segments: BottleSegment[]) {
  let filled = 0;
  return segments.map((segment) => {
    const height = (FILL_HEIGHT * segment.pct) / 100;
    filled += height;
    return { ...segment, y: BODY.bottom - filled, height };
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
