import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { formulaHash } from "@/lib/formula";
import { AuthorizationError, GUEST, NotFoundError, ValidationError } from "@/server/dal/actor";
import { getOwnScentForMixer, saveDraft, saveScent } from "@/server/dal/scents";
import { seed } from "../../scripts/seed-data";
import { loadCatalog, setIngredientActive } from "../support/catalog";
import { freshTestDatabase, testDatabaseUrl } from "../support/db";
import { actorFor, createUser } from "../support/factories";

type Connection = Awaited<ReturnType<typeof freshTestDatabase>>;

describe.skipIf(!testDatabaseUrl)("saved scents DAL", () => {
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

  const formula = () => [
    catalog.entry("Sandalwood"),
    catalog.entry("Rose"),
    catalog.entry("Jasmine"),
    catalog.entry("Bergamot"),
  ];

  async function row(id: string) {
    const [r] = await conn.db.select().from(conn.schema.savedScents).where(eq(conn.schema.savedScents.id, id));
    return r;
  }

  it("saves a complete blend with its formula hash", async () => {
    const actor = actorFor(await createUser(conn.db));
    const { id } = await saveScent(actor, {
      name: "  Midnight Bloom ",
      formula: formula(),
      bottleOptionId: catalog.bottle(50, "spray").id,
    });
    const saved = await row(id);
    expect(saved).toMatchObject({ userId: actor.userId, status: "saved", name: "Midnight Bloom" });
    expect(saved.formulaHash).toBe(await formulaHash(formula()));
  });

  it("rejects guests, incomplete blends, a 4th ingredient per tier and wrong tiers", async () => {
    const actor = actorFor(await createUser(conn.db));
    const bottleOptionId = catalog.bottle(50, "spray").id;
    await expect(saveScent(GUEST, { name: "x", formula: formula(), bottleOptionId })).rejects.toBeInstanceOf(
      AuthorizationError,
    );
    await expect(saveScent(actor, { name: "x", formula: formula().slice(0, 3), bottleOptionId })).rejects.toThrow();
    const fourBase = ["Sandalwood", "Musk", "Amber", "Cedarwood"].map(catalog.entry);
    await expect(
      saveScent(actor, { name: "x", formula: [...fourBase, catalog.entry("Rose"), catalog.entry("Mint")], bottleOptionId }),
    ).rejects.toThrow();
    const wrongTier = [{ ...catalog.entry("Rose"), tier: "base" as const }, catalog.entry("Iris"), catalog.entry("Mint")];
    await expect(saveScent(actor, { name: "x", formula: wrongTier, bottleOptionId })).rejects.toBeInstanceOf(ValidationError);
  });

  it("refuses discontinued ingredients", async () => {
    const actor = actorFor(await createUser(conn.db));
    await setIngredientActive(conn.db, catalog.ing("Jasmine").id, false);
    try {
      await expect(
        saveScent(actor, { name: "x", formula: formula(), bottleOptionId: catalog.bottle(50, "spray").id }),
      ).rejects.toThrow(/Jasmine is no longer available/);
    } finally {
      await setIngredientActive(conn.db, catalog.ing("Jasmine").id, true);
    }
  });

  it("updates the same draft, then turns it into the saved scent", async () => {
    const actor = actorFor(await createUser(conn.db));
    const first = await saveDraft(actor, { formula: [catalog.entry("Sandalwood")], currentStep: "heart" });
    const again = await saveDraft(actor, {
      draftId: first.id,
      formula: [catalog.entry("Sandalwood"), catalog.entry("Rose")],
      currentStep: "top",
      name: "Work in progress",
    });
    expect(again.id).toBe(first.id);
    expect(await row(first.id)).toMatchObject({ status: "draft", currentStep: "top", formulaHash: null });

    const saved = await saveScent(actor, {
      name: "Finished",
      formula: formula(),
      bottleOptionId: catalog.bottle(30, "spray").id,
      draftId: first.id,
    });
    expect(saved.id).toBe(first.id);
    expect(await row(first.id)).toMatchObject({ status: "saved", currentStep: null, name: "Finished" });
  });

  it("Edit saves a new version and never changes the original", async () => {
    const actor = actorFor(await createUser(conn.db));
    const original = await saveScent(actor, { name: "Original", formula: formula(), bottleOptionId: catalog.bottle(50, "spray").id });
    const edited = await saveScent(actor, {
      name: "Original v2",
      formula: [catalog.entry("Oud"), catalog.entry("Rose"), catalog.entry("Mint")],
      bottleOptionId: catalog.bottle(50, "spray").id,
      parentScentId: original.id,
    });
    expect(edited.id).not.toBe(original.id);
    expect((await row(edited.id)).parentScentId).toBe(original.id);
    expect((await row(original.id)).name).toBe("Original");
  });

  it("users can't load, update or branch from someone else's scent", async () => {
    const owner = actorFor(await createUser(conn.db));
    const other = actorFor(await createUser(conn.db));
    const draft = await saveDraft(owner, { formula: [catalog.entry("Musk")], currentStep: "base" });
    const saved = await saveScent(owner, { name: "Mine", formula: formula(), bottleOptionId: catalog.bottle(50, "spray").id });

    await expect(getOwnScentForMixer(other, draft.id)).rejects.toBeInstanceOf(NotFoundError);
    // Another user's draft ID is ignored: a new draft is created instead of overwriting.
    const theirs = await saveDraft(other, { draftId: draft.id, formula: [catalog.entry("Amber")], currentStep: "base" });
    expect(theirs.id).not.toBe(draft.id);
    expect((await row(draft.id)).formula).toEqual([catalog.entry("Musk")]);
    await expect(
      saveScent(other, { name: "Copy", formula: formula(), bottleOptionId: catalog.bottle(50, "spray").id, parentScentId: saved.id }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect((await getOwnScentForMixer(owner, draft.id)).status).toBe("draft");
  });
});
