import "server-only";
import { and, eq } from "drizzle-orm";
import { findFormulaIssues, formulaHash, type Formula } from "@/lib/formula";
import type { MixerStep, SavedScentStatus } from "@/lib/domain";
import { saveDraftInputSchema, saveScentInputSchema, type SaveDraftInput, type SaveScentInput } from "@/lib/validation/scent";
import { getDb, schema, type Db, type Tx } from "@/server/db";
import { assertSignedIn, NotFoundError, ValidationError, type Actor } from "./actor";
import { getActiveBottleOption, getIngredientsByIds } from "./catalog";

async function assertFormulaUsable(formula: Formula, executor: Db | Tx) {
  const catalog = await getIngredientsByIds(
    formula.map((e) => e.ingredientId),
    executor,
  );
  const issues = findFormulaIssues(formula, catalog);
  if (issues.length === 0) return;
  const issue = issues[0];
  const name = catalog.get(issue.ingredientId)?.name;
  throw new ValidationError(
    issue.kind === "inactive_ingredient"
      ? `${name} is no longer available. Choose another ingredient.`
      : "One of the ingredients isn't available. Please rebuild your blend.",
  );
}

async function assertBottleOptionActive(id: string, executor: Db | Tx) {
  if (!(await getActiveBottleOption(id, executor))) {
    throw new ValidationError("That bottle size and format is no longer available.");
  }
}

async function ownScent(executor: Db | Tx, userId: string, id: string, status?: SavedScentStatus) {
  const [row] = await executor
    .select({ id: schema.savedScents.id, status: schema.savedScents.status })
    .from(schema.savedScents)
    .where(
      and(
        eq(schema.savedScents.id, id),
        eq(schema.savedScents.userId, userId),
        status ? eq(schema.savedScents.status, status) : undefined,
      ),
    );
  return row ?? null;
}

/**
 * Saves a finished blend to the actor's library. A formula is never edited in place:
 * Edit mode creates a new row pointing at its parent, and finishing a draft turns that
 * draft row into the saved scent.
 */
export async function saveScent(actor: Actor, input: SaveScentInput): Promise<{ id: string }> {
  assertSignedIn(actor);
  const data = saveScentInputSchema.parse(input);
  return getDb().transaction(async (tx) => {
    await assertFormulaUsable(data.formula, tx);
    await assertBottleOptionActive(data.bottleOptionId, tx);
    if (data.parentScentId && !(await ownScent(tx, actor.userId, data.parentScentId, "saved"))) {
      throw new NotFoundError("Original scent not found");
    }

    const values = {
      name: data.name,
      formula: data.formula,
      formulaHash: await formulaHash(data.formula),
      bottleOptionId: data.bottleOptionId,
      parentScentId: data.parentScentId ?? null,
      status: "saved" as const,
      currentStep: null,
    };

    if (data.draftId && (await ownScent(tx, actor.userId, data.draftId, "draft"))) {
      await tx.update(schema.savedScents).set(values).where(eq(schema.savedScents.id, data.draftId));
      return { id: data.draftId };
    }
    const [row] = await tx
      .insert(schema.savedScents)
      .values({ ...values, userId: actor.userId })
      .returning({ id: schema.savedScents.id });
    return row;
  });
}

/** Creates or updates one of the actor's drafts; drafts may be incomplete. */
export async function saveDraft(actor: Actor, input: SaveDraftInput): Promise<{ id: string }> {
  assertSignedIn(actor);
  const data = saveDraftInputSchema.parse(input);
  return getDb().transaction(async (tx) => {
    await assertFormulaUsable(data.formula, tx);
    const bottleOptionId =
      data.bottleOptionId && (await getActiveBottleOption(data.bottleOptionId, tx)) ? data.bottleOptionId : null;
    const parentScentId =
      data.parentScentId && (await ownScent(tx, actor.userId, data.parentScentId, "saved")) ? data.parentScentId : null;

    const values = {
      name: data.name || null,
      formula: data.formula,
      formulaHash: null,
      bottleOptionId,
      parentScentId,
      currentStep: data.currentStep,
      status: "draft" as const,
    };

    if (data.draftId && (await ownScent(tx, actor.userId, data.draftId, "draft"))) {
      await tx.update(schema.savedScents).set(values).where(eq(schema.savedScents.id, data.draftId));
      return { id: data.draftId };
    }
    const [row] = await tx
      .insert(schema.savedScents)
      .values({ ...values, userId: actor.userId })
      .returning({ id: schema.savedScents.id });
    return row;
  });
}

export type MixerScent = {
  id: string;
  status: SavedScentStatus;
  name: string | null;
  formula: Formula;
  bottleOptionId: string | null;
  currentStep: MixerStep | null;
};

/** One of the actor's own scents or drafts, for loading into the mixer. */
export async function getOwnScentForMixer(actor: Actor, id: string): Promise<MixerScent> {
  assertSignedIn(actor);
  const [row] = await getDb()
    .select({
      id: schema.savedScents.id,
      status: schema.savedScents.status,
      name: schema.savedScents.name,
      formula: schema.savedScents.formula,
      bottleOptionId: schema.savedScents.bottleOptionId,
      currentStep: schema.savedScents.currentStep,
    })
    .from(schema.savedScents)
    .where(and(eq(schema.savedScents.id, id), eq(schema.savedScents.userId, actor.userId)));
  if (!row) throw new NotFoundError("Scent not found");
  return row;
}
