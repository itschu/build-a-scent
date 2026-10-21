import { describe, expect, it } from "vitest";
import { mixColors } from "./color";

describe("mixColors", () => {
  it("averages channels", () => {
    expect(mixColors(["#000000", "#ffffff"])).toBe("#808080");
    expect(mixColors(["#c06080"])).toBe("#c06080");
    expect(mixColors([])).toBeNull();
  });
});
