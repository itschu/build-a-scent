// Dates are always shown in Lagos time so server and browser render the same text.
const dateFormatter = new Intl.DateTimeFormat("en-NG", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Africa/Lagos",
});

export function formatDate(value: Date | string): string {
  return dateFormatter.format(new Date(value));
}
