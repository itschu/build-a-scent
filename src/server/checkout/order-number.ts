import "server-only";
import { randomInt } from "node:crypto";

// No 0/O, 1/I/L: order numbers are read aloud and typed into the lookup form.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** Human-friendly, non-sequential order number, e.g. BAS-7K3M9Q. */
export function newOrderNumber(): string {
  let code = "";
  for (let i = 0; i < 6; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return `BAS-${code}`;
}

export function normalizeOrderNumber(input: string): string {
  const cleaned = input.trim().toUpperCase().replace(/\s+/g, "");
  return cleaned.startsWith("BAS-") ? cleaned : `BAS-${cleaned.replace(/^BAS/, "")}`;
}
