import { describe, expect, it } from "vitest";
import {
  canonicalFormula,
  draftFormulaSchema,
  findFormulaIssues,
  formulaHash,
  savedFormulaSchema,
  type CatalogIngredient,
  type Formula,
} from "./formula";

const id = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, "0")}`;

const complete: Formula = [
  { ingredientId: id(1), tier: "base" },
  { ingredientId: id(2), tier: "base" },
  { ingredientId: id(3), tier: "heart" },
  { ingredientId: id(4), tier: "top" },
];

describe("formula schemas", () => {
  it("accepts 1–3 ingredients per tier for a saved scent", () => {
    expect(savedFormulaSchema.safeParse(complete).success).toBe(true);
  });

  it("rejects a saved scent with an empty tier", () => {
    expect(savedFormulaSchema.safeParse(complete.slice(0, 3)).success).toBe(false);
  });

  it("rejects a fourth ingredient in a tier", () => {
    const four: Formula = [1, 2, 3, 4].map((n) => ({ ingredientId: id(n), tier: "base" }));
    expect(draftFormulaSchema.safeParse(four).success).toBe(false);
  });

  it("allows partial drafts but not duplicate ingredients", () => {
    expect(draftFormulaSchema.safeParse([]).success).toBe(true);
    expect(draftFormulaSchema.safeParse(complete.slice(0, 1)).success).toBe(true);
    const duplicated: Formula = [complete[0], { ...complete[0] }];
    expect(draftFormulaSchema.safeParse(duplicated).success).toBe(false);
  });
});

describe("findFormulaIssues", () => {
  it("reports unknown, inactive and wrong-tier ingredients", () => {
    const catalog = new Map<string, CatalogIngredient>([
      [id(1), { id: id(1), noteTier: "base", isActive: true }],
      [id(2), { id: id(2), noteTier: "base", isActive: false }],
      [id(3), { id: id(3), noteTier: "top", isActive: true }],
    ]);
    expect(findFormulaIssues(complete, catalog)).toEqual([
      { kind: "inactive_ingredient", ingredientId: id(2) },
      { kind: "wrong_tier", ingredientId: id(3), expected: "top", actual: "heart" },
      { kind: "unknown_ingredient", ingredientId: id(4) },
    ]);
  });
});

describe("formula hashing", () => {
  it("ignores ingredient order within a tier", async () => {
    const reordered: Formula = [complete[3], complete[1], complete[2], complete[0]];
    expect(canonicalFormula(reordered)).toBe(canonicalFormula(complete));
    expect(await formulaHash(reordered)).toBe(await formulaHash(complete));
  });

  it("distinguishes the same ingredient in a different tier", async () => {
    const moved: Formula = complete.map((e) =>
      e.ingredientId === id(2) ? { ...e, tier: "heart" } : e,
    );
    expect(await formulaHash(moved)).not.toBe(await formulaHash(complete));
  });

  it("produces a 64-character hex SHA-256", async () => {
    expect(await formulaHash(complete)).toMatch(/^[0-9a-f]{64}$/);
  });
});
