import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, it } from "vitest";

describe("GET /bottle-series/:series", () => {
  it("returns a bottle series", async ({ fixtures }) => {
    const brand = await fixtures.Entity({ name: "Ardbeg" });
    const series = await fixtures.BottleSeries({
      name: "Supernova",
      description: "A limited edition series",
      brandId: brand.id,
    });

    const result = await routerClient.bottleSeries.details({
      series: series.id,
    });

    expect(result).toMatchObject({
      id: series.id,
      name: series.name,
      fullName: series.fullName,
      description: series.description,
      numReleases: series.numReleases,
      brand: expect.objectContaining({
        id: brand.id,
        name: brand.name,
      }),
    });
  });

  it("returns 404 for non-existent series", async () => {
    const err = await waitError(
      routerClient.bottleSeries.details({
        series: 999999,
      })
    );
    expect(err).toMatchInlineSnapshot("[Error: Series not found.]");
  });
});
