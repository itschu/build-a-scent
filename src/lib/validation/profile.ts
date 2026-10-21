import { z } from "zod";
import { NIGERIAN_STATES } from "@/lib/nigeria";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v));

export const profileUpdateSchema = z.object({
  fullName: optionalText(120),
  displayName: optionalText(40),
  bio: optionalText(280),
  avatarUrl: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.url({ protocol: /^https$/ }).nullable()),
  phone: optionalText(20).refine(
    (v) => v === null || /^\+?[0-9 ()-]{7,20}$/.test(v),
    "Enter a valid phone number",
  ),
  deliveryAddress: optionalText(200),
  city: optionalText(80),
  state: z
    .string()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.enum(NIGERIAN_STATES).nullable()),
});

export type ProfileUpdate = z.output<typeof profileUpdateSchema>;
export type ProfileUpdateInput = z.input<typeof profileUpdateSchema>;
