import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AuthorizationError, NotFoundError, ValidationError } from "@/server/dal/actor";
import {
  DUPLICATE_FORMULA_MESSAGE,
  getListingDraft,
  getPublicListing,
  getSellerDashboard,
  listMarketplace,
  resubmitListing,
  submitListing,
  withdrawListing,
} from "@/server/dal/marketplace";
import { saveScent } from "@/server/dal/scents";
import { seed } from "../../scripts/seed-data";
import { loadCatalog, setIngredientActive } from "../support/catalog";
import { freshTestDatabase, testDatabaseUrl } from "../support/db";
import { actorFor, createUser } from "../support/factories";

type Connection = Awaited<ReturnType<typeof freshTestDatabase>>;

describe.skipIf(!testDatabaseUrl)("marketplace DAL", () => {
  let conn: Connection;
  let catalog: Awaited<ReturnType<typeof loadCatalog>>;

  beforeAll(async () => {
    conn = await freshTestDatabase();
    await seed(conn.db, { sampleData: true });
    catalog = await loadCatalog(conn.db);
  });

  afterAll(async () => {
    await conn?.close();
  });

  const spray50 = () => catalog.bottle(50, "spray").id;
  let n = 0;
  async function sellerWithScent(names = ["Sandalwood", "Rose", "Jasmine", "Bergamot"], verified = true) {
    const seller = actorFor(await createUser(conn.db, { emailVerified: verified, name: `Seller ${++n}` }));
    const { id } = await saveScent(seller, { name: `Scent ${n}`, formula: names.map(catalog.entry), bottleOptionId: spray50() });
    return { seller, scentId: id };
  }
  const edit = (featured: string[] = []) => ({ description: "Warm and floral", creatorMarkupKobo: 500_000, featuredIngredientIds: featured });
  const approve = (id: string) =>
    conn.db
      .update(conn.schema.marketplaceListings)
      .set({ status: "approved", approvedAt: new Date() })
      .where(eq(conn.schema.marketplaceListings.id, id));

  it("prepares the listing form with the live blend price", async () => {
    const { seller, scentId } = await sellerWithScent();
    const draft = await getListingDraft(seller, scentId);
    expect(draft).toMatchObject({ blendPriceKobo: 2_305_000, commissionPct: 20, minMarkupKobo: 100_000, emailVerified: true });
    expect(draft.ingredients).toHaveLength(4);
  });

  it("requires a verified email, the minimum markup and featured notes from the formula", async () => {
    const unverified = await sellerWithScent(["Musk", "Peony", "Mint"], false);
    await expect(submitListing(unverified.seller, { ...edit(), scentId: unverified.scentId })).rejects.toBeInstanceOf(AuthorizationError);

    const { seller, scentId } = await sellerWithScent(["Amber", "Iris", "Lemon"]);
    await expect(submitListing(seller, { ...edit(), creatorMarkupKobo: 50_000, scentId })).rejects.toBeInstanceOf(ValidationError);
    await expect(submitListing(seller, { ...edit([catalog.ing("Oud").id]), scentId })).rejects.toThrow(/must be ingredients/);
    const other = await sellerWithScent(["Vanilla", "Geranium", "Grapefruit"]);
    await expect(submitListing(seller, { ...edit(), scentId: other.scentId })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("creates a pending listing that isn't public until approved, and only once per scent", async () => {
    const { seller, scentId } = await sellerWithScent(["Cedarwood", "Ylang Ylang", "Lavender"]);
    const { id } = await submitListing(seller, { ...edit([catalog.ing("Ylang Ylang").id]), scentId });
    const [row] = await conn.db.select().from(conn.schema.marketplaceListings).where(eq(conn.schema.marketplaceListings.id, id));
    expect(row).toMatchObject({ status: "pending_review", creatorMarkupKobo: 500_000 });
    expect(await getPublicListing(id)).toBeNull();
    await expect(submitListing(seller, { ...edit(), scentId })).rejects.toBeInstanceOf(ValidationError);
    await expect(getListingDraft(seller, scentId)).rejects.toThrow(/already has a listing/);
  });

  it("blocks another seller's exact duplicate formula", async () => {
    const first = await sellerWithScent(["Oud", "Peony", "Pink Pepper"]);
    await submitListing(first.seller, { ...edit(), scentId: first.scentId });
    // Same ingredients in a different order is still the same formula.
    const copy = await sellerWithScent(["Oud", "Peony", "Pink Pepper"].reverse());
    await expect(submitListing(copy.seller, { ...edit(), scentId: copy.scentId })).rejects.toThrow(DUPLICATE_FORMULA_MESSAGE);
  });

  it("shows buyers a note profile and price, never the formula", async () => {
    const { seller, scentId } = await sellerWithScent(["Sandalwood", "Rose", "Jasmine", "Bergamot"]);
    const { id } = await submitListing(seller, { ...edit([catalog.ing("Rose").id]), scentId });
    await approve(id);

    const listing = await getPublicListing(id);
    expect(listing).toMatchObject({ buyerPriceKobo: 2_805_000, featuredNotes: ["Rose"], families: ["Woody", "Floral", "Citrus"] });
    const json = JSON.stringify([listing, await listMarketplace()]);
    for (const hidden of ["Sandalwood", "Jasmine", "Bergamot"]) expect(json).not.toContain(hidden);
    for (const hidden of ["Sandalwood", "Jasmine", "Bergamot"]) expect(json).not.toContain(catalog.ing(hidden).id);
    expect(json).not.toContain(scentId);
  });

  it("hides approved listings whose ingredient was discontinued", async () => {
    const { seller, scentId } = await sellerWithScent(["Musk", "Geranium", "Mint"]);
    const { id } = await submitListing(seller, { ...edit(), scentId });
    await approve(id);
    await setIngredientActive(conn.db, catalog.ing("Geranium").id, false);
    try {
      expect(await getPublicListing(id)).toBeNull();
      expect((await listMarketplace()).some((l) => l.id === id)).toBe(false);
    } finally {
      await setIngredientActive(conn.db, catalog.ing("Geranium").id, true);
    }
  });

  it("supports edit & resubmit after rejection, withdraw and relist, never by other users", async () => {
    const { seller, scentId } = await sellerWithScent(["Vanilla", "Iris", "Grapefruit"]);
    const stranger = actorFor(await createUser(conn.db));
    const { id } = await submitListing(seller, { ...edit(), scentId });

    await expect(resubmitListing(seller, id, edit())).rejects.toThrow(/Only rejected or withdrawn/);
    await conn.db
      .update(conn.schema.marketplaceListings)
      .set({ status: "rejected", rejectionReason: "Description too vague" })
      .where(eq(conn.schema.marketplaceListings.id, id));
    await expect(resubmitListing(stranger, id, edit())).rejects.toBeInstanceOf(NotFoundError);
    await resubmitListing(seller, id, { ...edit(), creatorMarkupKobo: 700_000 });
    let [row] = await conn.db.select().from(conn.schema.marketplaceListings).where(eq(conn.schema.marketplaceListings.id, id));
    expect(row).toMatchObject({ status: "pending_review", rejectionReason: null, creatorMarkupKobo: 700_000 });

    await expect(withdrawListing(stranger, id)).rejects.toBeInstanceOf(NotFoundError);
    expect(await withdrawListing(seller, id)).toEqual({ wasLive: false });
    await resubmitListing(seller, id, edit());
    [row] = await conn.db.select().from(conn.schema.marketplaceListings).where(eq(conn.schema.marketplaceListings.id, id));
    expect(row.status).toBe("pending_review");

    const dashboard = await getSellerDashboard(seller);
    expect(dashboard.listings).toHaveLength(1);
    expect(dashboard.listings[0].split?.sellerEarningKobo).toBe(400_000);
    expect(dashboard.earnings).toMatchObject({ pendingKobo: 0, availableKobo: 0, entries: [] });
  });
});
