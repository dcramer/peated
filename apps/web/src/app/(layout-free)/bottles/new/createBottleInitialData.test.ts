import { describe, expect, test } from "vitest";
import { mergeCreateBottleInitialData } from "./createBottleInitialData";

describe("mergeCreateBottleInitialData", () => {
  test("preserves unresolved entity names when another entity id loads", () => {
    expect(
      mergeCreateBottleInitialData({
        initialData: {
          name: "Canonical Expression",
          category: "single_malt",
          brand: { name: "Unresolved Brand" },
          distillers: [{ name: "Unresolved Distillery" }],
        },
        brand: { id: 101, name: "Resolved Brand" },
      }),
    ).toMatchObject({
      category: "single_malt",
      brand: { id: 101, name: "Resolved Brand" },
      distillers: [{ name: "Unresolved Distillery" }],
    });
  });

  test("merges one independently complete proposed Bottle", () => {
    expect(
      mergeCreateBottleInitialData({
        initialData: {
          name: "Prefilled Expression",
          category: "single_malt",
          edition: "Prefilled Edition",
          abv: 43,
          brand: { name: "Prefilled Brand" },
        },
        proposalData: {
          name: "Reviewed Expression",
          edition: "Batch 7",
          abv: null,
          brand: { id: 101, name: "Reviewed Brand" },
        },
      }),
    ).toMatchObject({
      name: "Reviewed Expression",
      category: "single_malt",
      edition: "Batch 7",
      abv: null,
      brand: { id: 101, name: "Reviewed Brand" },
    });
  });
});
