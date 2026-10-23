import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GUEST, AuthorizationError, NotFoundError, ValidationError } from "@/server/dal/actor";
import { blockUser, unblockUser } from "@/server/dal/admin-users";
import { deleteDraft, deleteSavedScent, listLibrary, setSharing } from "@/server/dal/library";
import { submitListing, withdrawListing } from "@/server/dal/marketplace";
import { saveDraft, saveScent } from "@/server/dal/scents";
import { getSharedScent } from "@/server/dal/sharing";
import { seed } from "../../scripts/seed-data";
import { loadCatalog, setIngredientActive } from "../support/catalog";
import { freshTestDatabase, testDatabaseUrl } from "../support/db";
import { actorFor, createUser } from "../support/factories";

type Connection = Awaited<ReturnType<typeof freshTestDatabase>>;

describe.skipIf(!testDatabaseUrl)("library and sharing DAL", () => {
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

  const formula = () => ["Sandalwood", "Rose", "Jasmine", "Bergamot"].map(catalog.entry);
  const spray50 = () => catalog.bottle(50, "spray").id;

  it("lists only the actor's own scents, split into saved and drafts, with prices", async () => {
    const me = actorFor(await createUser(conn.db));
    const other = actorFor(await createUser(conn.db));
    await saveScent(me, { name: "Midnight Bloom", formula: formula(), bottleOptionId: spray50() });
    await saveDraft(me, { formula: [catalog.entry("Musk")], currentStep: "heart", name: "WIP" });
    await saveScent(other, { name: "Not mine", formula: formula(), bottleOptionId: spray50() });

    const library = await listLibrary(me);
    expect(library.saved.map((s) => s.name)).toEqual(["Midnight Bloom"]);
    expect(library.saved[0]).toMatchObject({ priceKobo: 2_305_000, availability: { available: true }, listing: null });
    expect(library.saved[0].bottle?.label).toBe("50ml · Spray");
    expect(library.drafts.map((d) => [d.name, d.currentStep])).toEqual([["WIP", "heart"]]);
    await expect(listLibrary(GUEST)).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("makes scents with a discontinued ingredient view-only", async () => {
    const me = actorFor(await createUser(conn.db));
    const { id } = await saveScent(me, { name: "Iris Dream", formula: ["Oud", "Iris", "Mint"].map(catalog.entry), bottleOptionId: spray50() });
    await setIngredientActive(conn.db, catalog.ing("Iris").id, false);
    try {
      const scent = (await listLibrary(me)).saved.find((s) => s.id === id)!;
      expect(scent.availability).toMatchObject({ available: false });
      expect(scent.priceKobo).toBeNull();
      expect(scent.ingredients.find((i) => i.name === "Iris")?.isActive).toBe(false);
      await expect(setSharing(me, id, true)).rejects.toBeInstanceOf(ValidationError);
    } finally {
      await setIngredientActive(conn.db, catalog.ing("Iris").id, true);
    }
  });

  it("deletes only the actor's own drafts", async () => {
    const me = actorFor(await createUser(conn.db));
    const other = actorFor(await createUser(conn.db));
    const draft = await saveDraft(me, { formula: [catalog.entry("Amber")], currentStep: "base" });
    const saved = await saveScent(me, { name: "Keep", formula: formula(), bottleOptionId: spray50() });
    await expect(deleteDraft(other, draft.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(deleteDraft(me, saved.id)).rejects.toBeInstanceOf(NotFoundError);
    await deleteDraft(me, draft.id);
    expect((await listLibrary(me)).drafts).toEqual([]);
  });

  it("shares by token, invalidates the link when turned off, and issues a new one on re-share", async () => {
    const me = actorFor(await createUser(conn.db, { name: "Adaeze Okonkwo" }));
    const other = actorFor(await createUser(conn.db));
    const { id } = await saveScent(me, { name: "Shared Bloom", formula: formula(), bottleOptionId: spray50() });

    await expect(setSharing(other, id, true)).rejects.toBeInstanceOf(NotFoundError);
    const { shareToken } = await setSharing(me, id, true);
    expect(shareToken).toMatch(/^[A-Za-z0-9_-]{24}$/);

    const shared = await getSharedScent(shareToken!);
    expect(shared).toMatchObject({ kind: "formula", name: "Shared Bloom", creatorName: "Adaeze", priceKobo: 2_305_000 });

    await setSharing(me, id, false);
    expect(await getSharedScent(shareToken!)).toBeNull();
    const again = await setSharing(me, id, true);
    expect(again.shareToken).not.toBe(shareToken);
    expect(await getSharedScent(shareToken!)).toBeNull();
  });

  it("hides the formula of a shared scent that has a live listing", async () => {
    const me = actorFor(await createUser(conn.db));
    const { id } = await saveScent(me, { name: "Listed Bloom", formula: formula(), bottleOptionId: spray50() });
    const { shareToken } = await setSharing(me, id, true);
    const [listing] = await conn.db
      .insert(conn.schema.marketplaceListings)
      .values({
        savedScentId: id,
        sellerId: me.userId,
        bottleOptionId: spray50(),
        creatorMarkupKobo: 500_000,
        featuredIngredientIds: [catalog.ing("Rose").id],
        status: "approved",
      })
      .returning();

    const shared = await getSharedScent(shareToken!);
    expect(shared?.kind).toBe("listed");
    expect(shared).toMatchObject({ listingId: listing.id });
    const json = JSON.stringify(shared);
    expect(json).toContain("Rose");
    for (const hidden of ["Sandalwood", "Jasmine", "Bergamot"]) expect(json).not.toContain(hidden);
    expect(json).not.toContain(catalog.ing("Sandalwood").id);

    const library = await listLibrary(me);
    expect(library.saved.find((s) => s.id === id)?.listing).toEqual({ id: listing.id, status: "approved" });
    await conn.db.delete(conn.schema.marketplaceListings).where(eq(conn.schema.marketplaceListings.id, listing.id));
  });

  describe("deleting saved scents", () => {
    const edit = { description: "", creatorMarkupKobo: 500_000, featuredIngredientIds: [] };

    it("deletes a saved scent and its share link stops working", async () => {
      const me = actorFor(await createUser(conn.db));
      const { id } = await saveScent(me, { name: "Short-lived", formula: formula(), bottleOptionId: spray50() });
      const { shareToken } = await setSharing(me, id, true);
      await deleteSavedScent(me, id);
      expect((await listLibrary(me)).saved).toHaveLength(0);
      expect(await getSharedScent(shareToken!)).toBeNull();
      await expect(deleteSavedScent(me, id)).rejects.toBeInstanceOf(NotFoundError);
    });

    it("only deletes the actor's own scents", async () => {
      const me = actorFor(await createUser(conn.db));
      const other = actorFor(await createUser(conn.db));
      const { id } = await saveScent(me, { name: "Mine", formula: formula(), bottleOptionId: spray50() });
      await expect(deleteSavedScent(other, id)).rejects.toBeInstanceOf(NotFoundError);
    });

    it("needs a listed scent withdrawn first, then deletes it with its old listing", async () => {
      const me = actorFor(await createUser(conn.db));
      const { id: scentId } = await saveScent(me, { name: "Listed", formula: ["Amber", "Peony", "Grapefruit"].map(catalog.entry), bottleOptionId: spray50() });
      const { id: listingId } = await submitListing(me, { ...edit, scentId });
      await expect(deleteSavedScent(me, scentId)).rejects.toThrow(/Withdraw the listing/);
      await withdrawListing(me, listingId);
      await deleteSavedScent(me, scentId);
      expect(await conn.db.select().from(conn.schema.marketplaceListings).where(eq(conn.schema.marketplaceListings.id, listingId))).toHaveLength(0);
    });

    it("keeps a scent whose listing has sales", async () => {
      const me = actorFor(await createUser(conn.db));
      const { id: scentId } = await saveScent(me, { name: "Sold", formula: ["Cedarwood", "Ylang Ylang", "Lavender"].map(catalog.entry), bottleOptionId: spray50() });
      const { id: listingId } = await submitListing(me, { ...edit, scentId });
      const [order] = await conn.db
        .insert(conn.schema.orders)
        .values({
          orderNumber: `BAS-SOLD-${Date.now()}`,
          email: "buyer@example.com",
          paymentGateway: "paystack",
          subtotalKobo: 1,
          shippingFeeKobo: 0,
          totalKobo: 1,
          deliveryAddress: { fullName: "B", phone: "1", address: "1", city: "Lagos", state: "Lagos" },
        })
        .returning();
      const [item] = await conn.db
        .insert(conn.schema.orderItems)
        .values({ orderId: order.id, itemType: "marketplace_listing", referenceId: listingId, itemSnapshot: {}, quantity: 1, unitPriceKobo: 1, lineTotalKobo: 1 })
        .returning();
      await conn.db.insert(conn.schema.sellerEarningsLedger).values({
        sellerId: me.userId,
        orderId: order.id,
        orderItemId: item.id,
        marketplaceListingId: listingId,
        amountKobo: 100,
        entryType: "sale_credit",
        status: "pending",
      });
      await withdrawListing(me, listingId);
      await expect(deleteSavedScent(me, scentId)).rejects.toThrow(/has marketplace sales/);
    });
  });

  it("keeps each blend's amounts, so reordering makes exactly that blend", async () => {
    const me = actorFor(await createUser(conn.db));
    const amounts: Record<string, number> = { Sandalwood: 50, Rose: 20, Jasmine: 15, Bergamot: 15 };
    const proportioned = Object.keys(amounts).map((n) => ({ ...catalog.entry(n), pct: amounts[n] }));
    await saveScent(me, { name: "Proportioned", formula: proportioned, bottleOptionId: spray50() });
    const [scent] = (await listLibrary(me)).saved;
    expect(scent.formula).toEqual(proportioned);
    expect(scent.ingredients.map((i) => i.pct)).toEqual([50, 20, 15, 15]);
    expect(scent.priceKobo).toBe(2_350_000);
  });

  it("hides share links of blocked accounts until they're unblocked", async () => {
    const admin = actorFor(await createUser(conn.db, { role: "admin" }));
    const me = actorFor(await createUser(conn.db));
    const { id } = await saveScent(me, { name: "Shared", formula: formula(), bottleOptionId: spray50() });
    const { shareToken } = await setSharing(me, id, true);
    await blockUser(admin, me.userId);
    expect(await getSharedScent(shareToken!)).toBeNull();
    await unblockUser(admin, me.userId);
    expect(await getSharedScent(shareToken!)).not.toBeNull();
  });
});
