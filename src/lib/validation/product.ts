import { z } from "zod";
import { BOTTLE_FORMATS } from "@/lib/domain";

const noteList = z.array(z.string().trim().min(1).max(40)).max(8);

export const productInputSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes")
    .max(80),
  description: z.string().trim().max(2000),
  scentFamily: z.string().trim().min(2, "Scent family is required").max(40),
  notes: z.object({ base: noteList, heart: noteList, top: noteList }),
  images: z.array(z.url({ protocol: /^https?$/ })).max(8),
});
export type ProductInput = z.input<typeof productInputSchema>;

export const variantInputSchema = z.object({
  sizeLabel: z.string().trim().min(1, "Size is required").max(20),
  format: z.enum(BOTTLE_FORMATS),
  priceKobo: z.number().int().positive("Price must be more than zero"),
  stockQty: z.number().int().min(0, "Stock can't be negative").max(100_000),
});
export type VariantInput = z.input<typeof variantInputSchema>;

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** "Oud, Amber" → ["Oud", "Amber"] */
export function parseNoteList(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
