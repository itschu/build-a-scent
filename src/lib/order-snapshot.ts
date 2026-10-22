// What an order line looked like at purchase (order_items.item_snapshot). Stored in full for
// fulfilment; buyers only ever see `buyerView`, which withholds marketplace formulas.
import type { BottleFormat, NoteTier } from "./domain";
import type { NoteProfile } from "./note-profile";
import type { MarketplaceSplit } from "./pricing";

export type SnapshotBottle = { id: string; label: string; volumeMl: number; format: BottleFormat };
export type SnapshotIngredient = {
  ingredientId: string;
  name: string;
  tier: NoteTier;
  colorHex: string;
  /** Share of the blend in percent, and the millilitres of it in this bottle's concentrate.
   * Absent on orders placed before amounts were recorded. */
  pct?: number;
  ml?: number;
};

export type CustomScentSnapshot = {
  type: "custom_scent";
  name: string;
  bottle: SnapshotBottle;
  formula: SnapshotIngredient[];
  basePriceKobo: number;
  ingredientCostKobo: number;
};

export type MarketplaceSnapshot = {
  type: "marketplace_listing";
  name: string;
  listingId: string;
  sellerId: string;
  creatorName: string;
  bottle: SnapshotBottle;
  /** Full formula, for the team blending the order. Never shown to the buyer. */
  formula: SnapshotIngredient[];
  profile: NoteProfile;
  /** Layer colours for the bottle visual (safe to show). */
  colors: Record<NoteTier, string[]>;
  split: MarketplaceSplit;
};

export type StandardProductSnapshot = {
  type: "standard_product";
  name: string;
  productId: string;
  variantId: string;
  variantLabel: string;
  imageUrl: string | null;
  notes: { base: string[]; heart: string[]; top: string[] };
};

export type ItemSnapshot = CustomScentSnapshot | MarketplaceSnapshot | StandardProductSnapshot;

export type BuyerItemView =
  | { type: "custom_scent"; name: string; detail: string; notes: Record<NoteTier, string[]>; colors: Record<NoteTier, string[]> }
  | { type: "marketplace_listing"; name: string; detail: string; creatorName: string; profile: NoteProfile; colors: Record<NoteTier, string[]> }
  | { type: "standard_product"; name: string; detail: string; imageUrl: string | null; notes: Record<NoteTier, string[]> };

function byTier<T>(items: SnapshotIngredient[], pick: (i: SnapshotIngredient) => T): Record<NoteTier, T[]> {
  return {
    base: items.filter((i) => i.tier === "base").map(pick),
    heart: items.filter((i) => i.tier === "heart").map(pick),
    top: items.filter((i) => i.tier === "top").map(pick),
  };
}

/** The redacted, buyer-safe view of an order line (Tech Plan, Decision 9). */
export function buyerView(snapshot: ItemSnapshot): BuyerItemView {
  switch (snapshot.type) {
    case "custom_scent":
      return {
        type: "custom_scent",
        name: snapshot.name,
        detail: `Custom scent · ${snapshot.bottle.label}`,
        notes: byTier(snapshot.formula, (i) => i.name),
        colors: byTier(snapshot.formula, (i) => i.colorHex),
      };
    case "marketplace_listing":
      return {
        type: "marketplace_listing",
        name: snapshot.name,
        detail: `Marketplace · ${snapshot.bottle.label}`,
        creatorName: snapshot.creatorName,
        profile: snapshot.profile,
        colors: snapshot.colors,
      };
    case "standard_product":
      return {
        type: "standard_product",
        name: snapshot.name,
        detail: snapshot.variantLabel,
        imageUrl: snapshot.imageUrl,
        notes: snapshot.notes,
      };
  }
}
