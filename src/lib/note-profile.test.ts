import { describe, expect, it } from "vitest";
import { noteProfile } from "./note-profile";

describe("noteProfile", () => {
  it("reveals families and only the featured ingredient names", () => {
    const ingredients = new Map([
      ["a", { name: "Sandalwood", scentFamily: "Woody" }],
      ["b", { name: "Cedarwood", scentFamily: "Woody" }],
      ["c", { name: "Rose", scentFamily: "Floral" }],
      ["d", { name: "Bergamot", scentFamily: "Citrus" }],
    ]);
    const profile = noteProfile(
      [
        { ingredientId: "a", tier: "base" },
        { ingredientId: "b", tier: "base" },
        { ingredientId: "c", tier: "heart" },
        { ingredientId: "d", tier: "top" },
      ],
      ingredients,
      ["c"],
    );
    expect(profile).toEqual({
      base: { families: ["Woody"], featured: [] },
      heart: { families: ["Floral"], featured: ["Rose"] },
      top: { families: ["Citrus"], featured: [] },
    });
    expect(JSON.stringify(profile)).not.toContain("Sandalwood");
  });
});
