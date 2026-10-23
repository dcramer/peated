import {
  mockBottle,
  mockCaolIlaEntity,
  mockHighlandParkEntity,
  mockSpringbankEntity,
  mockTaliskerEntity,
} from "@peated/server/orpc/mock/fixtures";
import { describe, expect, test } from "vitest";

import { toBottleListItem, toBottlePickerOption } from "./bottleListItem";

describe("toBottleListItem", () => {
  test("uses the full marketed name and separates provenance from release facts", () => {
    expect(toBottleListItem(mockBottle)).toMatchObject({
      name: "Lagavulin 16-year-old",
      provenance: [],
      metadata: ["43%"],
    });
  });

  const series = {
    id: 1088,
    peatedId: "S1088",
    name: "Private Collection",
    fullName: "Gordon & MacPhail Private Collection",
    description: null,
    numReleases: 12,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  const seriesBottle = {
    ...mockBottle,
    brand: { ...mockBottle.brand, id: 999, name: "Gordon & MacPhail" },
    distillers: [mockCaolIlaEntity],
    name: "Caol Ila 1982",
    series,
    statedAge: 40,
    vintageYear: 1982,
  };

  test("puts the series before the distillery instead of in the name", () => {
    expect(toBottleListItem(seriesBottle)).toMatchObject({
      name: "Gordon & MacPhail Caol Ila 1982",
      provenance: [
        {
          name: "Private Collection",
          href: "/series/1088-gordon-and-mac-phail-private-collection",
        },
        { name: mockCaolIlaEntity.name, href: expect.any(String) },
      ],
    });
  });

  test("keeps the series in the name for rows that hide provenance", () => {
    expect(
      toBottleListItem(seriesBottle, { seriesPlacement: "name" }),
    ).toMatchObject({
      name: "Gordon & MacPhail Private Collection Caol Ila 1982",
      provenance: [{ name: mockCaolIlaEntity.name, href: expect.any(String) }],
    });
  });

  test("omits the series on its own page and when the name prints it", () => {
    expect(
      toBottleListItem(seriesBottle, { seriesPlacement: "none" }),
    ).toMatchObject({
      name: "Gordon & MacPhail Caol Ila 1982",
      provenance: [{ name: mockCaolIlaEntity.name, href: expect.any(String) }],
    });
    expect(
      toBottleListItem({
        ...seriesBottle,
        name: "Private Collection Caol Ila 1982",
      }).provenance,
    ).toEqual([{ name: mockCaolIlaEntity.name, href: expect.any(String) }]);
  });

  test("does not repeat a year the name already prints", () => {
    expect(toBottleListItem(seriesBottle).metadata).toEqual([
      "40 years",
      "43%",
    ]);
    expect(
      toBottleListItem({ ...seriesBottle, name: "Caol Ila 19821" }).metadata,
    ).toEqual(["1982 vintage", "40 years", "43%"]);
    expect(
      toBottleListItem({
        ...seriesBottle,
        releaseYear: 2023,
        vintageYear: null,
        name: "Caol Ila 2023 Release",
      }).metadata,
    ).toEqual(["40 years", "43%"]);
  });

  test("shows one year, vintage before release", () => {
    expect(
      toBottleListItem({
        ...seriesBottle,
        name: "Caol Ila",
        releaseYear: 2023,
      }).metadata,
    ).toEqual(["1982 vintage", "40 years", "43%"]);
    expect(
      toBottleListItem({ ...seriesBottle, releaseYear: 2023 }).metadata,
    ).toEqual(["40 years", "43%"]);
    expect(
      toBottleListItem({
        ...seriesBottle,
        edition: "Batch 3",
        releaseYear: 2023,
      }).metadata,
    ).toEqual(["Batch 3", "40 years", "43%"]);
  });

  test("does not repeat an age or ABV the name already prints", () => {
    expect(
      toBottleListItem({
        ...mockBottle,
        name: "Lagavulin 16 Years Old 43%",
      }).metadata,
    ).toEqual([]);
    expect(
      toBottleListItem({ ...mockBottle, name: "Lagavulin 160 Years" }).metadata,
    ).toEqual(["16 years", "43%"]);
  });

  test("keeps a series that only appears inside a longer word", () => {
    expect(
      toBottleListItem({
        ...seriesBottle,
        name: "Private Collections Caol Ila 1982",
      }).provenance?.[0],
    ).toMatchObject({ name: "Private Collection" });
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
    ).toEqual([]);
  });

  test("shows up to three distilleries by name", () => {
    const distillers = [
      mockCaolIlaEntity,
      mockHighlandParkEntity,
      mockTaliskerEntity,
    ];

    expect(toBottleListItem({ ...mockBottle, distillers }).provenance).toEqual([
      ...distillers.map((distiller) => ({
        name: distiller.name,
        href: `/distillers/${distiller.id}-${distiller.name
          .toLowerCase()
          .replaceAll(" ", "-")}`,
      })),
    ]);
  });

  test("does not count the brand toward the distillery summary", () => {
    const distillers = [
      mockCaolIlaEntity,
      mockHighlandParkEntity,
      mockTaliskerEntity,
    ];

    expect(
      toBottleListItem({
        ...mockBottle,
        distillers: [mockBottle.brand, ...distillers],
      }).provenance?.map((item) => item.name),
    ).toEqual(distillers.map((distiller) => distiller.name));
  });

  test("summarizes more than three distilleries with their names in a tooltip", () => {
    const distillers = [
      mockCaolIlaEntity,
      mockHighlandParkEntity,
      mockSpringbankEntity,
      mockTaliskerEntity,
    ];

    expect(toBottleListItem({ ...mockBottle, distillers }).provenance).toEqual([
      {
        name: "4 distilleries",
        title: distillers.map((distiller) => distiller.name).join(" · "),
      },
    ]);
  });

  test("keeps the distillery tooltip inside a picker option", () => {
    const distillers = [
      mockCaolIlaEntity,
      mockHighlandParkEntity,
      mockSpringbankEntity,
      mockTaliskerEntity,
    ];

    expect(
      toBottlePickerOption({ ...mockBottle, distillers }).bottle.provenance,
    ).toContainEqual({
      name: "4 distilleries",
      title: distillers.map((distiller) => distiller.name).join(" · "),
    });
  });

  test("keeps the database ID for selection and removes links inside the option control", () => {
    const option = toBottlePickerOption({
      ...mockBottle,
      brand: { ...mockBottle.brand, id: 999 },
      distillers: [mockBottle.brand],
    });

    expect(option.id).toBe(mockBottle.id);
    expect(option.label).toBe(`${option.bottle.name} · 43%`);
    expect(option.bottle.provenance).toEqual([{ name: "Lagavulin" }]);
    expect(option.bottle.metadata).toEqual(["43%"]);
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
    ).toEqual([]);
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
    ).toEqual(["NAS"]);
  });
});
