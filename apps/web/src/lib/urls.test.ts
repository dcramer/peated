import { describe, expect, it } from "vitest";
import { getBottleUrl, getEntityUrl } from "./urls";

const bottle = {
  id: 123,
  name: "16-year-old",
  brand: { name: "Lagavulin" },
};

describe("public catalog URLs", () => {
  it("uses the Bottle collection, ID, and display name", () => {
    expect(getBottleUrl(bottle)).toBe("/bottles/123-lagavulin-16-year-old");
  });

  it.each([
    ["brand", "/brands/123"],
    ["distillery", "/distillers/123"],
    ["bottler", "/bottlers/123"],
    ["company", "/companies/123"],
  ] as const)("uses the %s Entity collection", (kind, expected) => {
    expect(getEntityUrl({ id: 123, kind, name: "Lagavulin" })).toBe(
      `${expected}-lagavulin`,
    );
  });

  it("uses the generic Entity route when kind is unavailable", () => {
    expect(getEntityUrl({ id: 123, kind: null, name: "Lagavulin" })).toBe(
      "/entities/123-lagavulin",
    );
  });

  it.each([
    ["Pōkeno", "pokeno"],
    ["Nikka 宮城峡", "nikka"],
    ["東京", "東京"],
    ["🥃", "entity"],
  ])("creates an Entity URL for %s", (name, slug) => {
    expect(getEntityUrl({ id: 123, kind: "distillery", name })).toBe(
      `/distillers/123-${slug}`,
    );
  });

  it("uses a non-empty Bottle slug when the display name has no letters", () => {
    expect(getBottleUrl({ id: 123, name: "🥃", brand: { name: "🥃" } })).toBe(
      "/bottles/123-bottle",
    );
  });
});
