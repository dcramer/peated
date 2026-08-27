import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

describe("GET /entities/:entity/catalog", () => {
  test("summarizes overlapping Bottle relationships and related Entities", async ({
    fixtures,
  }) => {
    const entity = await fixtures.Entity({
      name: "Summary Entity",
      kind: "distillery",
    });
    const alphaBrand = await fixtures.Entity({ name: "Alpha Brand" });
    const betaBrand = await fixtures.Entity({ name: "Beta Brand" });
    const outsideBottler = await fixtures.Entity({ name: "Outside Bottler" });
    const sourceA = await fixtures.Entity({ name: "Source A" });
    const sourceB = await fixtures.Entity({ name: "Source B" });

    await fixtures.Bottle({
      name: "Overlapping Roles",
      brandId: entity.id,
      bottlerId: entity.id,
      distillerIds: [entity.id],
      category: "bourbon",
      totalTastings: 3,
      avgRating: 1.5,
    });
    await fixtures.Bottle({
      name: "Bottled Release",
      brandId: alphaBrand.id,
      bottlerId: entity.id,
      distillerIds: [sourceA.id, sourceB.id],
      category: "blend",
      totalTastings: 2,
    });
    await fixtures.Bottle({
      name: "Distilled Release",
      brandId: betaBrand.id,
      bottlerId: outsideBottler.id,
      distillerIds: [entity.id],
      category: "single_malt",
      totalTastings: 1,
    });
    await fixtures.Bottle({
      name: "Unrelated Release",
      brandId: alphaBrand.id,
      bottlerId: outsideBottler.id,
      distillerIds: [sourceA.id],
      category: "rye",
    });

    const data = await routerClient.entities.catalog({ entity: entity.id });

    expect(data).toEqual({
      totalBottles: 3,
      relationships: { brand: 1, bottler: 2, distiller: 2 },
      distilleryCoverage: { documented: 3, total: 3 },
      categories: [
        { category: "blend", count: 1 },
        { category: "bourbon", count: 1 },
        { category: "single_malt", count: 1 },
      ],
      related: {
        brands: [
          {
            id: alphaBrand.id,
            name: "Alpha Brand",
            shortName: null,
            kind: null,
            count: 1,
          },
          {
            id: betaBrand.id,
            name: "Beta Brand",
            shortName: null,
            kind: null,
            count: 1,
          },
        ],
        bottlers: [
          {
            id: outsideBottler.id,
            name: "Outside Bottler",
            shortName: null,
            kind: null,
            count: 1,
          },
        ],
        distillers: [
          {
            id: sourceA.id,
            name: "Source A",
            shortName: null,
            kind: null,
            count: 1,
          },
          {
            id: sourceB.id,
            name: "Source B",
            shortName: null,
            kind: null,
            count: 1,
          },
        ],
      },
      notableBottles: [
        {
          id: expect.any(Number),
          fullName: "Summary Entity Overlapping Roles",
          totalTastings: 3,
          avgRating: 1.5,
        },
        {
          id: expect.any(Number),
          fullName: "Alpha Brand Bottled Release",
          totalTastings: 2,
          avgRating: null,
        },
        {
          id: expect.any(Number),
          fullName: "Beta Brand Distilled Release",
          totalTastings: 1,
          avgRating: null,
        },
      ],
    });
  });

  test("returns an empty summary when an entity has no bottles", async ({
    fixtures,
  }) => {
    const entity = await fixtures.Entity();

    await expect(
      routerClient.entities.catalog({ entity: entity.id }),
    ).resolves.toEqual({
      totalBottles: 0,
      relationships: { brand: 0, bottler: 0, distiller: 0 },
      distilleryCoverage: { documented: 0, total: 0 },
      categories: [],
      related: { brands: [], bottlers: [], distillers: [] },
      notableBottles: [],
    });
  });

  test("throws for an unknown entity", async () => {
    const err = await waitError(
      routerClient.entities.catalog({ entity: 999999 }),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Entity not found.]`);
  });
});
