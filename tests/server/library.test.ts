import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GUEST, AuthorizationError, NotFoundError, ValidationError } from "@/server/dal/actor";
import { deleteDraft, listLibrary, setSharing } from "@/server/dal/library";
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
});
