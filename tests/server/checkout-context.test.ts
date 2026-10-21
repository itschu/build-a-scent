import { describe, expect, it } from "vitest";
import { decodeCheckoutContext, encodeCheckoutContext } from "@/server/checkout/context";
import { newOrderNumber, normalizeOrderNumber } from "@/server/checkout/order-number";

describe("checkout context", () => {
  const orderId = "8f14e45f-ceea-467f-a0e6-1234567890ab";

  it("round-trips and expires after two hours", () => {
    const now = Date.now();
    const token = encodeCheckoutContext(orderId, now);
    expect(decodeCheckoutContext(token, now)).toBe(orderId);
    expect(decodeCheckoutContext(token, now + 2 * 60 * 60 * 1000 + 1000)).toBeNull();
  });

  it("rejects tampering", () => {
    const token = encodeCheckoutContext(orderId);
    const [, exp, sig] = token.split(".");
    expect(decodeCheckoutContext(`00000000-0000-4000-8000-000000000000.${exp}.${sig}`)).toBeNull();
    expect(decodeCheckoutContext(`${orderId}.${Number(exp) + 999999}.${sig}`)).toBeNull();
    expect(decodeCheckoutContext("garbage")).toBeNull();
  });
});

describe("order numbers", () => {
  it("are BAS- plus 6 unambiguous characters", () => {
    for (let i = 0; i < 50; i++) expect(newOrderNumber()).toMatch(/^BAS-[2-9A-HJKMNP-Z]{6}$/);
    expect(normalizeOrderNumber(" bas-7k3m9q ")).toBe("BAS-7K3M9Q");
    expect(normalizeOrderNumber("7k3m9q")).toBe("BAS-7K3M9Q");
  });
});
