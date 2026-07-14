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
});
