import { describe, expect, it } from "vitest";
import { addDays, deliveryWindow, formatWindow, lagosToday } from "./delivery-estimate";

describe("delivery estimate", () => {
  it("uses the Lagos calendar day", () => {
    // 23:30 UTC on 31 Dec is already 1 Jan in Lagos (UTC+1).
    expect(lagosToday(new Date("2026-12-31T23:30:00Z"))).toBe("2027-01-01");
  });

  it("adds lead time to the zone ETA", () => {
    expect(deliveryWindow(3, { etaMinDays: 2, etaMaxDays: 4 }, new Date("2026-10-21T10:00:00Z"))).toEqual({
      from: "2026-10-26",
      to: "2026-10-28",
    });
    expect(addDays("2026-02-27", 2)).toBe("2026-03-01");
    expect(formatWindow("2026-10-26", "2026-10-28")).toBe("26 Oct – 28 Oct");
  });
});
