"use client";

import { usePublicSettings } from "@/hooks/use-public-settings";
import { useCurrencyStore } from "@/lib/currency-store";
import { formatNaira, formatUsd } from "@/lib/money";

/** A kobo amount in the visitor's display currency (NGN unless they chose USD). */
export function Price({ kobo, className }: { kobo: number; className?: string }) {
  const currency = useCurrencyStore((s) => s.currency);
  const settings = usePublicSettings();
  const usd = currency === "USD" && settings ? formatUsd(kobo, settings.usd_exchange_rate) : null;
  return <span className={className}>{usd ?? formatNaira(kobo)}</span>;
}

export function CurrencyToggle() {
  const { currency, toggle } = useCurrencyStore();
  return (
    <button
      type="button"
      onClick={toggle}
      className="font-serif text-[0.65rem] uppercase tracking-label text-faint hover:text-gold"
      aria-label={currency === "NGN" ? "Show prices in US dollars" : "Show prices in naira"}
    >
      {currency === "NGN" ? "View in USD →" : "View in NGN →"}
    </button>
  );
}

export function UsdNote() {
  const currency = useCurrencyStore((s) => s.currency);
  if (currency !== "USD") return null;
  return <p className="text-xs text-faint">USD prices are estimates. You&apos;ll be charged in naira (NGN).</p>;
}
