import { describe, expect, it } from "vitest";
import { routerClient } from "../router";

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

    const { results } = await routerClient.bottleSeriesList({
      brand: brand.id,
    });

    expect(results).toHaveLength(2);
    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: series1.id,
          name: series1.name,
          description: series1.description,
          brand: expect.objectContaining({
            id: brand.id,
            name: brand.name,
          }),
        }),
        expect.objectContaining({
          id: series2.id,
          name: series2.name,
          description: series2.description,
          brand: expect.objectContaining({
            id: brand.id,
            name: brand.name,
          }),
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

    const { results } = await routerClient.bottleSeriesList({
      brand: brand.id,
      query: "supernova",
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: series1.id,
      name: series1.name,
      description: series1.description,
      brand: expect.objectContaining({
        id: brand.id,
        name: brand.name,
      }),
    });
  });

  it("returns empty list for non-existent brand", async function ({
    fixtures,
    defaults,
  }) {
    const { results } = await routerClient.bottleSeriesList({
      brand: 12345,
    });

    expect(results).toHaveLength(0);
  });
});
