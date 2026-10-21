import { describe, expect, it } from "vitest";
import { defaultSettings, parseSettings, PUBLIC_SETTING_KEYS } from "./settings";

describe("settings", () => {
  it("never exposes private keys publicly", () => {
    expect(PUBLIC_SETTING_KEYS).not.toContain("low_stock_reserve_threshold");
    expect(PUBLIC_SETTING_KEYS).toContain("commission_pct");
  });

  it("default tier shares sum to 100", () => {
    const d = defaultSettings();
    expect(d.tier_share_base + d.tier_share_heart + d.tier_share_top).toBe(100);
  });

  it("falls back to defaults for missing, unknown or invalid rows", () => {
    const parsed = parseSettings([
      { key: "commission_pct", value: 15 },
      { key: "reservation_ttl_minutes", value: -1 },
      { key: "not_a_setting", value: 1 },
    ]);
    expect(parsed.commission_pct).toBe(15);
    expect(parsed.reservation_ttl_minutes).toBe(30);
    expect(parsed.usd_exchange_rate).toBe(defaultSettings().usd_exchange_rate);
  });
});
