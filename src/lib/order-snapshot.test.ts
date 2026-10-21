import { describe, expect, it } from "vitest";
import { buyerView, type MarketplaceSnapshot } from "./order-snapshot";

describe("buyerView", () => {
  it("never includes a marketplace formula", () => {
    const snapshot: MarketplaceSnapshot = {
      type: "marketplace_listing",
      name: "Midnight Bloom",
      listingId: "l1",
      sellerId: "s1",
      creatorName: "Adaeze",
      bottle: { id: "b", label: "50ml · Spray", volumeMl: 50, format: "spray" },
      formula: [
        { ingredientId: "i-secret", name: "Secret Oud", tier: "base", colorHex: "#111111" },
        { ingredientId: "i-rose", name: "Rose", tier: "heart", colorHex: "#c06080" },
      ],
      profile: {
        base: { families: ["Woody"], featured: [] },
        heart: { families: ["Floral"], featured: ["Rose"] },
        top: { families: [], featured: [] },
      },
      colors: { base: ["#111111"], heart: ["#c06080"], top: [] },
      split: {
        blendPriceKobo: 1,
        creatorMarkupKobo: 1,
        buyerPriceKobo: 2,
        commissionPct: 20,
        commissionKobo: 0,
        platformFeeKobo: 1,
        sellerEarningKobo: 1,
      },
    };
    const json = JSON.stringify(buyerView(snapshot));
    expect(json).not.toContain("Secret Oud");
    expect(json).not.toContain("i-secret");
    expect(json).not.toContain("sellerEarning");
    expect(json).toContain("Rose");
  });
});
