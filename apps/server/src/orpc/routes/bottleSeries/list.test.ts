import { db } from "@peated/server/db";
import { bottleTombstones } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, it } from "vitest";

describe("GET /bottle-series", () => {
  it("lists series for a brand", async function ({ fixtures }) {
    const brand = await fixtures.Entity({ name: "Ardbeg" });

    const series1 = await fixtures.BottleSeries({
      name: "Supernova",
      description: "A series of heavily peated whiskies",
      brandId: brand.id,
    });

    const series2 = await fixtures.BottleSeries({
      name: "Committee Release",
      description: "Special releases for committee members",
      brandId: brand.id,
    });

    const otherBrand = await fixtures.Entity({ name: "Macallan" });
    await fixtures.BottleSeries({
      name: "Edition No.",
      description: "Annual limited editions",
      brandId: otherBrand.id,
    });

    const { results } = await routerClient.bottleSeries.list({
      brand: brand.id,
    });

    expect(results).toHaveLength(2);
    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: series1.id,
          name: series1.name,
          description: series1.description,
          brand: expect.objectContaining({ id: brand.id, name: brand.name }),
        }),
        expect.objectContaining({
          id: series2.id,
          name: series2.name,
          description: series2.description,
        }),
      ]),
    );
  });

  it("lists a distillery's series by matching bottle count", async function ({
    fixtures,
  }) {
    const distillery = await fixtures.Entity({
      kind: "distillery",
      name: "Port Ellen",
    });
    const otherDistillery = await fixtures.Entity({
      kind: "distillery",
      name: "Brora",
    });
    const brand = await fixtures.Entity({ kind: "brand", name: "Rare Malts" });
    const seriesWithTwoBottles = await fixtures.BottleSeries({
      brandId: brand.id,
      name: "Rare Series",
    });
    const seriesWithOneBottle = await fixtures.BottleSeries({
      brandId: brand.id,
      name: "Special Releases",
    });
    const unrelatedSeries = await fixtures.BottleSeries({
      brandId: brand.id,
      name: "Other Distillery",
    });

    await fixtures.Bottle({
      brandId: brand.id,
      distillerIds: [distillery.id],
      seriesId: seriesWithTwoBottles.id,
    });
    await fixtures.Bottle({
      brandId: brand.id,
      distillerIds: [distillery.id],
      seriesId: seriesWithTwoBottles.id,
    });
    await fixtures.Bottle({
      brandId: brand.id,
      distillerIds: [distillery.id],
      seriesId: seriesWithOneBottle.id,
    });
    await fixtures.Bottle({
      brandId: brand.id,
      distillerIds: [otherDistillery.id],
      seriesId: unrelatedSeries.id,
    });
    await fixtures.LegacyBottle({
      brandId: brand.id,
      distillerIds: [distillery.id],
      seriesId: seriesWithTwoBottles.id,
    });
    const retiredBottle = await fixtures.Bottle({
      brandId: brand.id,
      distillerIds: [distillery.id],
      seriesId: seriesWithTwoBottles.id,
    });
    const replacementBottle = await fixtures.Bottle({
      brandId: brand.id,
      distillerIds: [otherDistillery.id],
    });
    await db.insert(bottleTombstones).values({
      bottleId: retiredBottle.id,
      newBottleId: replacementBottle.id,
    });

    const result = await routerClient.bottleSeries.list({
      distillery: distillery.id,
      sort: "-bottles",
    });

    expect(result.total).toBe(2);
    expect(result.results).toMatchObject([
      {
        id: seriesWithTwoBottles.id,
        brand: { id: brand.id, name: brand.name },
        numBottles: 2,
      },
      {
        id: seriesWithOneBottle.id,
        brand: { id: brand.id, name: brand.name },
        numBottles: 1,
      },
    ]);
  });

  it("rejects an unsupported sort", async function () {
    // SAFETY: This test sends an unsupported value through the public input boundary.
    const error = await waitError(() =>
      routerClient.bottleSeries.list({ sort: "popular" as "name" }),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Input validation failed]`);
  });

  it("filters series by query", async function ({ fixtures }) {
    const brand = await fixtures.Entity({ name: "Ardbeg" });

    const series1 = await fixtures.BottleSeries({
      name: "Supernova",
      brandId: brand.id,
    });

    await fixtures.BottleSeries({
      name: "Committee Release",
      brandId: brand.id,
    });

    const { results } = await routerClient.bottleSeries.list({
      brand: brand.id,
      query: "supernova",
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: series1.id,
      name: series1.name,
      description: series1.description,
    });
  });

  it("returns empty list for non-existent brand", async function () {
    const { results } = await routerClient.bottleSeries.list({
      brand: 12345,
    });

    expect(results).toHaveLength(0);
  });

  it("lists all series with working cursor pagination", async function ({
    fixtures,
  }) {
    const firstBrand = await fixtures.Entity({ name: "A Series Brand" });
    const secondBrand = await fixtures.Entity({ name: "B Series Brand" });
    await fixtures.BottleSeries({ name: "Alpha", brandId: firstBrand.id });
    await fixtures.BottleSeries({ name: "Beta", brandId: secondBrand.id });

    const firstPage = await routerClient.bottleSeries.list({ limit: 1 });
    const secondPage = await routerClient.bottleSeries.list({
      cursor: firstPage.rel.nextCursor!,
      limit: 1,
    });

    expect(firstPage.total).toBeGreaterThanOrEqual(2);
    expect(firstPage.results).toHaveLength(1);
    expect(firstPage.rel.nextCursor).toBe(2);
    expect(secondPage.results).toHaveLength(1);
    expect(secondPage.results[0]?.id).not.toBe(firstPage.results[0]?.id);
  });
});
