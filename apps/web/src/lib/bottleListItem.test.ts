import { mockBottle } from "@peated/server/orpc/mock/fixtures";
import { describe, expect, test } from "vitest";

import { toBottleListItem } from "./bottleListItem";

describe("toBottleListItem", () => {
  test("uses the full marketed name and separates provenance from release facts", () => {
    expect(toBottleListItem(mockBottle)).toMatchObject({
      name: "Lagavulin 16-year-old",
      provenance: [{ name: "Single Malt" }],
      metadata: ["16 years", "43.0% ABV"],
    });
  });

  test.each([
    ["brand", "brands"],
    ["distillery", "distillers"],
    ["bottler", "bottlers"],
    ["company", "companies"],
  ] as const)(
    "links a %s used as a distinct distiller to its own collection",
    (kind, collection) => {
      const bottle = {
        ...mockBottle,
        brand: { ...mockBottle.brand, id: 999 },
        distillers: [{ ...mockBottle.brand, kind }],
      };

      expect(toBottleListItem(bottle).provenance).toContainEqual({
        name: "Lagavulin",
        href: `/${collection}/9201-lagavulin`,
      });
    },
  );

  test("does not repeat a distiller already identified by the brand", () => {
    expect(
      toBottleListItem({ ...mockBottle, distillers: [mockBottle.brand] })
        .provenance,
    ).toEqual([{ name: "Single Malt" }]);
  });

  test("can omit the brand from a list owned by that brand", () => {
    expect(
      toBottleListItem(mockBottle, {
        includeBrandInName: false,
      }),
    ).toMatchObject({
      name: "16-year-old",
    });
  });

  test("identifies a distinct bottler when the surrounding view needs it", () => {
    const bottler = {
      ...mockBottle.brand,
      id: 4263,
      peatedId: "E4263",
      name: "The Scotch Malt Whisky Society",
      shortName: "SMWS",
      kind: "bottler" as const,
    };

    expect(
      toBottleListItem({ ...mockBottle, bottler }, { includeBottler: true })
        .provenance,
    ).toContainEqual({
      name: "Bottled by SMWS",
      href: "/bottlers/4263-the-scotch-malt-whisky-society",
    });
  });

  test("does not repeat the brand when it also fills the bottler role", () => {
    expect(
      toBottleListItem(
        { ...mockBottle, bottler: mockBottle.brand },
        { includeBottler: true },
      ).provenance,
    ).toEqual([{ name: "Single Malt" }]);
  });

  test("uses only known release facts without manufacturing missing dates or ages", () => {
    expect(
      toBottleListItem({
        ...mockBottle,
        releaseYear: 2026,
        releaseMonth: null,
        releaseDay: null,
        statedAge: null,
        noAgeStatement: null,
        abv: null,
      }).metadata,
    ).toEqual(["2026 release"]);
    expect(
      toBottleListItem({
        ...mockBottle,
        releaseYear: null,
        statedAge: null,
        noAgeStatement: true,
        abv: null,
      }).metadata,
    ).toEqual(["No age statement"]);
  });
});
