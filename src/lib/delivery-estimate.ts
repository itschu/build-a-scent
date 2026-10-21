/** Today's date in Lagos as YYYY-MM-DD. */
export function lagosToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(now);
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Delivery window: production lead time plus the shipping zone's ETA range. */
export function deliveryWindow(
  leadDays: number,
  zone: { etaMinDays: number; etaMaxDays: number },
  now = new Date(),
): { from: string; to: string } {
  const today = lagosToday(now);
  return { from: addDays(today, leadDays + zone.etaMinDays), to: addDays(today, leadDays + zone.etaMaxDays) };
}

const display = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", timeZone: "UTC" });

/** "5 Nov – 9 Nov" */
export function formatWindow(from: string, to: string): string {
  return `${display.format(new Date(`${from}T00:00:00Z`))} – ${display.format(new Date(`${to}T00:00:00Z`))}`;
}
