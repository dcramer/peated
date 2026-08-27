import { describe, expect, it } from "vitest";
import { getBottleUrl, getEntityRoutePrefixes, getEntityUrl } from "./urls";

describe("public catalog URLs", () => {
  it("uses the Bottle collection and numeric ID", () => {
    expect(getBottleUrl({ id: 123 })).toBe("/bottles/123");
  });

  it.each([
    ["brand", "/brands/123"],
    ["distillery", "/distillers/123"],
    ["bottler", "/bottlers/123"],
    ["blender", "/blenders/123"],
    ["company", "/companies/123"],
  ] as const)("uses the %s Entity collection", (kind, expected) => {
    expect(getEntityUrl({ id: 123, kind })).toBe(expected);
  });

  it("lists every route prefix that can resolve an Entity", () => {
    expect(getEntityRoutePrefixes(123)).toEqual([
      "/brands/123",
      "/distillers/123",
      "/bottlers/123",
      "/blenders/123",
      "/companies/123",
      "/entities/123",
    ]);
  });
});
