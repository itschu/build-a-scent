import { describe, expect, it } from "vitest";
import { formatNaira, formatUsd, parseNairaToKobo } from "./money";

describe("money", () => {
  it("formats kobo as naira", () => {
    expect(formatNaira(2_305_000)).toBe("₦23,050");
    expect(formatNaira(2_305_050)).toBe("₦23,050.50");
  });

  it("converts to USD for display only", () => {
    expect(formatUsd(1_600_000, 1_600)).toBe("$10.00");
  });

  it("parses admin-entered amounts without floating-point error", () => {
    expect(parseNairaToKobo("23,050")).toBe(2_305_000);
    expect(parseNairaToKobo("₦0.1")).toBe(10);
    expect(parseNairaToKobo("19.99")).toBe(1_999);
    expect(parseNairaToKobo("-5")).toBeNull();
    expect(parseNairaToKobo("1.234")).toBeNull();
    expect(parseNairaToKobo("abc")).toBeNull();
  });
});
