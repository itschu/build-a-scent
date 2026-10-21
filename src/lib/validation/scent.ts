import { z } from "zod";
import { MIXER_STEPS } from "@/lib/domain";
import { draftFormulaSchema, savedFormulaSchema } from "@/lib/formula";

export const SCENT_NAME_MAX = 40;

export const scentNameSchema = z
  .string()
  .trim()
  .min(1, "Give your scent a name")
  .max(SCENT_NAME_MAX, `Keep the name under ${SCENT_NAME_MAX} characters`);

export const saveScentInputSchema = z.object({
  name: scentNameSchema,
  formula: savedFormulaSchema,
  bottleOptionId: z.uuid(),
  /** Set when saving from the mixer's Edit mode; the original stays untouched. */
  parentScentId: z.uuid().nullish(),
  /** Set when finishing a resumed draft; that draft becomes the saved scent. */
  draftId: z.uuid().nullish(),
});
export type SaveScentInput = z.input<typeof saveScentInputSchema>;

export const saveDraftInputSchema = z.object({
  draftId: z.uuid().nullish(),
  name: z.string().trim().max(SCENT_NAME_MAX).nullish(),
  formula: draftFormulaSchema.refine((f) => f.length > 0, "Add at least one ingredient first"),
  bottleOptionId: z.uuid().nullish(),
  currentStep: z.enum(MIXER_STEPS),
  parentScentId: z.uuid().nullish(),
});
export type SaveDraftInput = z.input<typeof saveDraftInputSchema>;
