import { db } from "@peated/server/db";
import { bottleTombstones } from "@peated/server/db/schema";
import { routerClient } from "@peated/server/orpc/router";

describe("GET /bottles/sitemap", () => {
  test("lists only current public Bottles in ID order", async ({
    fixtures,
  }) => {
    const first = await fixtures.Bottle({ name: "First Sitemap Bottle" });
    const retired = await fixtures.Bottle({ name: "Retired Sitemap Bottle" });
    const replacement = await fixtures.Bottle({
      name: "Replacement Sitemap Bottle",
    });
    await fixtures.LegacyBottle({ name: "Legacy Sitemap Bottle" });
    await db.insert(bottleTombstones).values({
      bottleId: retired.id,
      newBottleId: replacement.id,
    });

    const { results } = await routerClient.bottles.sitemap({ page: 1 });

    expect(results.map(({ id }) => id)).toEqual([first.id, replacement.id]);
  });

  test("returns the fields used for the Bottle display name", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({
      name: "Sitemap Distillery",
      shortName: "Sitemap",
    });
    const series = await fixtures.BottleSeries({
      brandId: brand.id,
      name: "Committee Release",
    });
    const bottle = await fixtures.Bottle({
      brandId: brand.id,
      seriesId: series.id,
      name: "Supernova",
      edition: "SN2019",
      statedAge: 12,
      abv: 53.8,
    });

    const { results } = await routerClient.bottles.sitemap({ page: 1 });

    expect(results).toEqual([
      {
        id: bottle.id,
        name: bottle.name,
        edition: "SN2019",
        statedAge: 12,
        vintageYear: null,
        releaseYear: null,
        abv: 53.8,
        singleCask: bottle.singleCask,
        caskStrength: bottle.caskStrength,
        brand: { name: "Sitemap Distillery", shortName: "Sitemap" },
        series: { name: "Committee Release" },
        group: { name: expect.any(String) },
        updatedAt: bottle.updatedAt.toISOString(),
      },
    ]);
  });
});
