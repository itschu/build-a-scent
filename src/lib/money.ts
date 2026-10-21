const nairaFormatter = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 2 });
const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

/** 2305000 → "₦23,050"; 2305050 → "₦23,050.50" (kobo shown only when present). */
export function formatNaira(kobo: number): string {
  const naira = kobo / 100;
  const text = Number.isInteger(naira)
    ? nairaFormatter.format(naira)
    : naira.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `₦${text}`;
}

/** Display-only USD conversion; `usdExchangeRate` is naira per US dollar. */
export function formatUsd(kobo: number, usdExchangeRate: number): string {
  if (!(usdExchangeRate > 0)) throw new Error("USD exchange rate must be positive");
  return usdFormatter.format(kobo / 100 / usdExchangeRate);
}

/**
 * Parses an admin-entered naira amount ("23,050" or "23050.50") into kobo without
 * floating-point error. Returns null for anything that is not a valid amount.
 */
export function parseNairaToKobo(input: string): number | null {
  const cleaned = input.trim().replace(/^₦/, "").replaceAll(",", "");
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  const kobo = BigInt(match[1]) * 100n + BigInt((match[2] ?? "").padEnd(2, "0"));
  if (kobo > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(kobo);
}
