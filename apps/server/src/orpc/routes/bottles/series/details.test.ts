import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, it } from "vitest";

describe("GET /bottle-series/:id", () => {
  it("returns a bottle series", async function ({ fixtures }) {
    const brand = await fixtures.Entity({ name: "Ardbeg" });
    const series = await fixtures.BottleSeries({
      name: "Supernova",
      description: "A limited edition series",
      brandId: brand.id,
    });

    const result = await routerClient.bottles.series.details({
      id: series.id,
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

  it("returns 404 for non-existent series", async function () {
    const err = await waitError(
      routerClient.bottles.series.details({
        id: 999999,
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Series not found.]`);
  });
});
