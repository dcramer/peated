import { describe, expect, it } from "vitest";
import {
  getBottleSeriesUrl,
  getBottleUrl,
  getEntityKindSearchUrl,
  getEntityUrl,
  getTastingUrl,
} from "./urls";

const bottle = {
  id: 123,
  name: "16-year-old",
  brand: { name: "Lagavulin" },
};

describe("public catalog URLs", () => {
  it("uses the Bottle collection, ID, and display name", () => {
    expect(getBottleUrl(bottle)).toBe("/bottles/123-lagavulin-16-year-old");
  });

  it("uses the tasting ID with its Bottle's display name", () => {
    expect(getTastingUrl({ id: 456, bottle })).toBe(
      "/tastings/456-lagavulin-16-year-old",
    );
  });

  it.each([
    ["Pōkeno", "pokeno"],
    ["東京", "東京"],
    ["🥃", "tasting"],
  ])("creates a tasting URL for %s", (name, slug) => {
    expect(
      getTastingUrl({ id: 456, bottle: { name, brand: { name: "" } } }),
    ).toBe(`/tastings/456-${slug}`);
  });

  it("uses the Series collection, ID, and full name", () => {
    expect(
      getBottleSeriesUrl({
        id: 421,
        fullName: "Dramfool Jim McEwan Signature Collection",
      }),
    ).toBe("/series/421-dramfool-jim-mc-ewan-signature-collection");
  });

  it.each([
    ["brand", "/brands"],
    ["distillery", "/distillers"],
    ["bottler", "/bottlers"],
    ["company", "/companies"],
  ] as const)("uses the %s Entity collection", (kind, expected) => {
    expect(getEntityUrl({ id: 123, kind, name: "Lagavulin" })).toBe(
      `${expected}/123-lagavulin`,
    );
    expect(getEntityKindSearchUrl(kind)).toBe(expected);
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
