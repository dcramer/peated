import { describe, expect, it } from "vitest";
import { getBottleUrl, getEntityUrl } from "./urls";

describe("public catalog URLs", () => {
  it("uses the Bottle collection and numeric ID", () => {
    expect(getBottleUrl({ id: 123 })).toBe("/bottles/123");
  });

  it.each([
    ["brand", "/brands/123"],
    ["distillery", "/distillers/123"],
    ["bottler", "/bottlers/123"],
    ["company", "/companies/123"],
  ] as const)("uses the %s Entity collection", (kind, expected) => {
    expect(getEntityUrl({ id: 123, kind })).toBe(expected);
  });

  it("uses the generic Entity route when kind is unavailable", () => {
    expect(getEntityUrl({ id: 123, kind: null })).toBe("/entities/123");
  });
});
