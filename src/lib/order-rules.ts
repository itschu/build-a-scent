// Order rules from platform settings, shared by checkout (authoritative) and the cart and
// checkout pages (display). All amounts are integer kobo; a 0 threshold or minimum is off.

/** The shipping fee once the free-shipping threshold is applied. */
export function shippingFeeKobo(zoneFeeKobo: number, subtotalKobo: number, freeShippingThresholdKobo: number): number {
  return freeShippingThresholdKobo > 0 && subtotalKobo >= freeShippingThresholdKobo ? 0 : zoneFeeKobo;
}

/** How much more is needed to qualify for free shipping (0 when it already applies or is off). */
export function freeShippingShortfallKobo(subtotalKobo: number, freeShippingThresholdKobo: number): number {
  return freeShippingThresholdKobo > 0 ? Math.max(0, freeShippingThresholdKobo - subtotalKobo) : 0;
}

/** How far the subtotal is below the minimum order (0 when it meets it or there is none). */
export function minOrderShortfallKobo(subtotalKobo: number, minOrderKobo: number): number {
  return minOrderKobo > 0 ? Math.max(0, minOrderKobo - subtotalKobo) : 0;
}

export const CHECKOUT_PAUSED_DEFAULT = "Checkout is paused right now. Please check back soon.";
