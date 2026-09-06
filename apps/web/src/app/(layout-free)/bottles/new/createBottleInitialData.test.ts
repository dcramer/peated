import { describe, expect, test } from "vitest";
import {
  applyLeadingBrandMatch,
  getLeadingEntityPrefixes,
  mergeCreateBottleInitialData,
} from "./createBottleInitialData";

describe("getLeadingEntityPrefixes", () => {
  test("returns longest-first prefixes that leave a bottle name", () => {
    expect(getLeadingEntityPrefixes("The Macallan 18 Year Old")).toEqual([
      "The Macallan 18 Year",
      "The Macallan 18",
      "The Macallan",
      "The",
    ]);
    expect(getLeadingEntityPrefixes("Lagavulin")).toEqual([]);
  });
});

describe("applyLeadingBrandMatch", () => {
  test("uses the longest unambiguous leading Entity and keeps the remainder", () => {
    expect(
      applyLeadingBrandMatch({ name: "The Macallan 18 Year Old" }, [
        { prefix: "The Macallan", results: [{ id: 101, name: "Macallan" }] },
        { prefix: "The", results: [{ id: 102, name: "The Lakes" }] },
      ]),
    ).toEqual({
      brand: { id: 101, name: "Macallan" },
      name: "18 Year Old",
    });
  });

  test("does not guess when a reference is ambiguous", () => {
    const initialData = { name: "Lagavulin 16" };

    expect(
      applyLeadingBrandMatch(initialData, [
        {
          prefix: "Lagavulin",
          results: [
            { id: 101, name: "Lagavulin" },
            { id: 102, name: "Lagavulin Independent" },
          ],
        },
      ]),
    ).toBe(initialData);
  });

  test("preserves an explicit brand", () => {
    expect(
      applyLeadingBrandMatch(
        { brand: { id: 101, name: "Chosen Brand" }, name: "Lagavulin 16" },
        [
          {
            prefix: "Lagavulin",
            results: [{ id: 102, name: "Lagavulin" }],
          },
        ],
      ),
    ).toEqual({
      brand: { id: 101, name: "Chosen Brand" },
      name: "Lagavulin 16",
    });
  });
});

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
