import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setEmailTransportForTests } from "@/server/email";
import { AuthorizationError, ValidationError } from "@/server/dal/actor";
import { getPublicListing, resubmitListing, submitListing } from "@/server/dal/marketplace";
import { approveListing, countPendingListings, listPendingListings, rejectListing } from "@/server/dal/moderation";
import { listNotifications } from "@/server/dal/notifications";
import { saveScent } from "@/server/dal/scents";
import { seed } from "../../scripts/seed-data";
import { loadCatalog } from "../support/catalog";
import { freshTestDatabase, testDatabaseUrl } from "../support/db";
import { actorFor, createUser } from "../support/factories";

type Connection = Awaited<ReturnType<typeof freshTestDatabase>>;

describe.skipIf(!testDatabaseUrl)("listing moderation", () => {
  let conn: Connection;
  let catalog: Awaited<ReturnType<typeof loadCatalog>>;
  let admin: ReturnType<typeof actorFor>;
  const sent: Array<{ to: string; subject: string }> = [];

  beforeAll(async () => {
    conn = await freshTestDatabase();
    await seed(conn.db, { sampleData: true });
    catalog = await loadCatalog(conn.db);
    admin = actorFor(await createUser(conn.db, { role: "admin" }));
    setEmailTransportForTests({ sendMail: async (m: { to: string; subject: string }) => (sent.push({ to: m.to, subject: m.subject }), {}) } as never);
  });

  afterAll(async () => {
    setEmailTransportForTests(undefined);
    await conn?.close();
  });

  let n = 0;
  async function pendingListing(names: string[]) {
    const user = await createUser(conn.db, { name: `Seller ${++n}` });
    const seller = actorFor(user);
    const { id: scentId } = await saveScent(seller, { name: `Scent ${n}`, formula: names.map(catalog.entry), bottleOptionId: catalog.bottle(50, "spray").id });
    const { id } = await submitListing(seller, {
      scentId,
      description: "",
      creatorMarkupKobo: 500_000,
      featuredIngredientIds: [catalog.ing(names[1]).id],
    });
    return { id, seller, email: user.email, scentName: `Scent ${n}` };
  }

  it("only admins can see the queue or decide", async () => {
    const { id, seller } = await pendingListing(["Sandalwood", "Rose", "Bergamot"]);
    await expect(listPendingListings(seller)).rejects.toBeInstanceOf(AuthorizationError);
    await expect(approveListing(seller, id)).rejects.toBeInstanceOf(AuthorizationError);
    await expect(rejectListing(seller, id, "no")).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("shows admins the full formula and the price breakdown", async () => {
    const { id } = await pendingListing(["Oud", "Iris", "Mint"]);
    const { items, total } = await listPendingListings(admin);
    expect(total).toBe(await countPendingListings(admin));
    const item = items.find((i) => i.id === id)!;
    expect(item.formula.map((f) => [f.name, f.featured])).toEqual([["Oud", false], ["Iris", true], ["Mint", false]]);
    expect(item.split?.sellerEarningKobo).toBe(400_000);
  });

  it("approval makes the listing live and notifies the seller once", async () => {
    const { id, seller, email, scentName } = await pendingListing(["Amber", "Jasmine", "Lemon"]);
    await approveListing(admin, id);
    expect(await getPublicListing(id)).not.toBeNull();
    const notes = await listNotifications(seller);
    expect(notes[0]).toMatchObject({ type: "listing_approved", message: `Your scent ${scentName} is now live on the marketplace!` });
    expect(sent.filter((m) => m.to === email)).toEqual([{ to: email, subject: `${scentName} is now live on the marketplace` }]);
    await expect(approveListing(admin, id)).rejects.toBeInstanceOf(ValidationError);
    expect(sent.filter((m) => m.to === email)).toHaveLength(1);
  });

  it("rejection requires a reason, which the seller receives; resubmission re-enters the queue", async () => {
    const { id, seller, email } = await pendingListing(["Cedarwood", "Peony", "Grapefruit"]);
    await expect(rejectListing(admin, id, "   ")).rejects.toThrow(/reason/);
    await rejectListing(admin, id, "Please remove the medical claims.");
    const [row] = await conn.db.select().from(conn.schema.marketplaceListings).where(eq(conn.schema.marketplaceListings.id, id));
    expect(row).toMatchObject({ status: "rejected", rejectionReason: "Please remove the medical claims." });
    expect((await listNotifications(seller))[0].message).toContain("Please remove the medical claims.");
    expect(sent.filter((m) => m.to === email)).toHaveLength(1);

    await resubmitListing(seller, id, { description: "Fixed", creatorMarkupKobo: 500_000, featuredIngredientIds: [] });
    expect((await listPendingListings(admin)).items.some((i) => i.id === id)).toBe(true);
    await approveListing(admin, id);
    // A second decision on a new submission emails again.
    expect(sent.filter((m) => m.to === email)).toHaveLength(2);
  });

  it("flags possible duplicates", async () => {
    const first = await pendingListing(["Vanilla", "Geranium", "Pink Pepper"]);
    // Same seller can't be blocked by the guard, so simulate a matching formula on another listing.
    const second = await pendingListing(["Musk", "Ylang Ylang", "Lavender"]);
    const [a] = await conn.db
      .select({ hash: conn.schema.savedScents.formulaHash })
      .from(conn.schema.marketplaceListings)
      .innerJoin(conn.schema.savedScents, eq(conn.schema.savedScents.id, conn.schema.marketplaceListings.savedScentId))
      .where(eq(conn.schema.marketplaceListings.id, first.id));
    const [l2] = await conn.db.select().from(conn.schema.marketplaceListings).where(eq(conn.schema.marketplaceListings.id, second.id));
    await conn.db.update(conn.schema.savedScents).set({ formulaHash: a.hash }).where(eq(conn.schema.savedScents.id, l2.savedScentId));
    const item = (await listPendingListings(admin)).items.find((i) => i.id === second.id)!;
    expect(item.duplicates.map((d) => d.id)).toContain(first.id);
  });
});
