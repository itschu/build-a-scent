import { z } from "zod";
import { MAX_LINE_QUANTITY } from "@/lib/cart/cart";
import { PAYMENT_GATEWAYS } from "@/lib/domain";
import { savedFormulaSchema } from "@/lib/formula";
import { NIGERIAN_STATES } from "@/lib/nigeria";
import { scentNameSchema } from "./scent";

const quantity = z.number().int().min(1).max(MAX_LINE_QUANTITY);
const displayPrice = z.number().int().nonnegative();

export const checkoutLineSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("custom_scent"),
    key: z.string(),
    name: scentNameSchema,
    formula: savedFormulaSchema,
    bottleOptionId: z.uuid(),
    quantity,
    displayPriceKobo: displayPrice,
  }),
  z.object({ type: z.literal("marketplace_listing"), key: z.string(), listingId: z.uuid(), quantity, displayPriceKobo: displayPrice }),
  z.object({ type: z.literal("standard_product"), key: z.string(), variantId: z.uuid(), quantity, displayPriceKobo: displayPrice }),
]);
export type CheckoutLine = z.infer<typeof checkoutLineSchema>;

export const deliverySchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(120),
  email: z.email("Enter a valid email").trim().toLowerCase(),
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number"),
  address: z.string().trim().min(5, "Enter your street address").max(200),
  city: z.string().trim().min(2, "Enter your city").max(80),
  state: z.enum(NIGERIAN_STATES, { message: "Choose a state" }),
});
export type DeliveryInput = z.input<typeof deliverySchema>;

export const checkoutRequestSchema = z.object({
  lines: z.array(checkoutLineSchema).min(1, "Your cart is empty").max(30),
  delivery: deliverySchema,
  gateway: z.enum(PAYMENT_GATEWAYS),
});
export type CheckoutRequest = z.input<typeof checkoutRequestSchema>;
