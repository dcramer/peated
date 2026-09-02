import { routerClient } from "@peated/server/orpc/router";

describe("GET /countries/:country/regions/:region/categories", () => {
  test("lists active Bottle categories by producing distillery", async ({
    fixtures,
  }) => {
    const country = await fixtures.Country({ slug: "scotland" });
    const region = await fixtures.Region({
      countryId: country.id,
      slug: "islay",
    });
    const otherRegion = await fixtures.Region({
      countryId: country.id,
      slug: "speyside",
    });
    const distiller = await fixtures.Entity({
      countryId: country.id,
      regionId: region.id,
      kind: "distillery",
    });
    const otherDistiller = await fixtures.Entity({
      countryId: country.id,
      regionId: otherRegion.id,
      kind: "distillery",
    });
    await fixtures.Bottle({
      category: "single_malt",
      distillerIds: [distiller.id],
    });
    await fixtures.Bottle({
      category: "blend",
      distillerIds: [otherDistiller.id],
    });

    const data = await routerClient.regions.categories({
      country: country.slug,
      region: region.slug,
    });

    expect(data).toEqual({
      results: [{ category: "single_malt", count: 1 }],
      totalCount: 1,
    });
  });

  test("returns an empty summary", async ({ fixtures }) => {
    const country = await fixtures.Country();
    const region = await fixtures.Region({ countryId: country.id });

    await expect(
      routerClient.regions.categories({
        country: country.id,
        region: region.id,
      }),
    ).resolves.toEqual({ results: [], totalCount: 0 });
  });

  test("rejects a region outside the country", async ({ fixtures }) => {
    const country = await fixtures.Country();
    const otherCountry = await fixtures.Country();
    const region = await fixtures.Region({ countryId: otherCountry.id });

    await expect(
      routerClient.regions.categories({
        country: country.id,
        region: region.id,
      }),
    ).rejects.toThrow("Invalid region.");
  });
});
