import { describe, expect, it } from "vitest";
import { buildBottleSearchDocuments, buildBottleSearchVector } from "./search";

describe("buildBottleSearchVector", () => {
  it("indexes a bottle's series as primary identity", () => {
    const vector = buildBottleSearchVector(
      {
        fullName: "Decadent Drinks Glenburgie 38-year-old",
        name: "Glenburgie 38-year-old",
        brandId: 1,
        createdByActorId: 1,
      },
      {
        name: "Decadent Drinks",
        kind: "bottler",
        createdByActorId: 1,
      },
      [],
      undefined,
      [],
      {
        name: "Whiskyland",
        fullName: "Decadent Drinks Whiskyland",
        brandId: 1,
        createdByActorId: 1,
      },
    );

    expect(vector).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: "Whiskyland", weight: "A" }),
      ]),
    );
  });
});

it("keeps decimal strength precision in search documents", () => {
  const vector = buildBottleSearchVector(
    {
      name: "Single Cask",
      fullName: "Test Single Cask",
      brandId: 1,
      createdByActorId: 1,
      abv: 56.75,
    },
    { name: "Test", kind: "brand", createdByActorId: 1 },
  );
  const document = buildBottleSearchDocuments(vector);
  expect(document.searchTerms).toContain("56.75% ABV");
  expect(document.searchTerms).not.toContain("56.8% ABV");
});
