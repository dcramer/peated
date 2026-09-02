import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, it } from "vitest";

describe("GET /bottle-series/:series", () => {
  it("returns a bottle series", async function ({ fixtures }) {
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
      peatedId: `S${String(series.id).padStart(4, "0")}`,
      name: series.name,
      fullName: series.fullName,
      description: series.description,
      numReleases: series.numReleases,
      brand: {
        id: brand.id,
        name: brand.name,
      },
      distillers: [],
    });
  });

  it("returns Distilleries with their active Series Bottle counts", async function ({
    fixtures,
  }) {
    const brand = await fixtures.Entity({ name: "Dramfool" });
    const [bruichladdich, bowmore] = await Promise.all([
      fixtures.Entity({ kind: "distillery", name: "Bruichladdich" }),
      fixtures.Entity({ kind: "distillery", name: "Bowmore" }),
    ]);
    const series = await fixtures.BottleSeries({
      brandId: brand.id,
      name: "Signature Collection",
    });
    await Promise.all([
      fixtures.Bottle({
        brandId: brand.id,
        distillerIds: [bruichladdich.id],
        seriesId: series.id,
      }),
      fixtures.Bottle({
        brandId: brand.id,
        distillerIds: [bruichladdich.id],
        seriesId: series.id,
      }),
      fixtures.Bottle({
        brandId: brand.id,
        distillerIds: [bowmore.id],
        seriesId: series.id,
      }),
    ]);

    const result = await routerClient.bottleSeries.details({
      series: series.id,
    });

    expect(result.distillers).toEqual([
      expect.objectContaining({
        id: bruichladdich.id,
        name: "Bruichladdich",
        numBottles: 2,
        peatedId: `E${String(bruichladdich.id).padStart(4, "0")}`,
      }),
      expect.objectContaining({
        id: bowmore.id,
        name: "Bowmore",
        numBottles: 1,
        peatedId: `E${String(bowmore.id).padStart(4, "0")}`,
      }),
    ]);
  });

  it("returns 404 for non-existent series", async function () {
    const err = await waitError(
      routerClient.bottleSeries.details({
        series: 999999,
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Series not found.]`);
  });
});
