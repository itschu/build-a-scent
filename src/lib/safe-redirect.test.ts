import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath", () => {
  it("allows same-site paths and rejects everything else", () => {
    expect(safeRedirectPath("/library?tab=drafts")).toBe("/library?tab=drafts");
    expect(safeRedirectPath("https://evil.example")).toBe("/");
    expect(safeRedirectPath("//evil.example")).toBe("/");
    expect(safeRedirectPath("/\\evil.example")).toBe("/");
    expect(safeRedirectPath(null, "/account")).toBe("/account");
  });
});
