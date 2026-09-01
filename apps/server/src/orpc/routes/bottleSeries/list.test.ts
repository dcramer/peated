import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, it } from "vitest";

describe("GET /bottle-series", () => {
  it("lists series for a brand", async function ({ fixtures, defaults }) {
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

    // Create a series for another brand to ensure filtering works
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
        }),
        expect.objectContaining({
          id: series2.id,
          name: series2.name,
          description: series2.description,
        }),
      ]),
    );
  });

  it("filters series by query", async function ({ fixtures, defaults }) {
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

  it("returns empty list for non-existent brand", async function ({
    fixtures,
    defaults,
  }) {
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
