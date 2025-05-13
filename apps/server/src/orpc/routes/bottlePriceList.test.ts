import { routerClient } from "../router";

describe("GET /bottles/:bottle/prices", () => {
  test("includes prices older than a week by default", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    const recentPrice = await fixtures.StorePrice({
      externalSiteId: (
        await fixtures.ExternalSite({
          type: "astorwines",
        })
      ).id,
      bottleId: bottle.id,
    });
    const oldPrice = await fixtures.StorePrice({
      externalSiteId: (
        await fixtures.ExternalSite({
          type: "totalwine",
        })
      ).id,
      bottleId: bottle.id,
      updatedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    });

    const result = await routerClient.bottlePriceList({
      bottle: bottle.id,
    });

    expect(result.results.length).toBe(2);
    expect(result.results[0].id).toBe(recentPrice.id);
    expect(result.results[1].id).toBe(oldPrice.id);
  });

  test("excludes prices older than a week when onlyValid is true", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const recentPrice = await fixtures.StorePrice({
      externalSiteId: (
        await fixtures.ExternalSite({
          type: "astorwines",
        })
      ).id,
      bottleId: bottle.id,
    });
    const oldPrice = await fixtures.StorePrice({
      externalSiteId: (
        await fixtures.ExternalSite({
          type: "totalwine",
        })
      ).id,
      bottleId: bottle.id,
      updatedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    });

    const result = await routerClient.bottlePriceList({
      bottle: bottle.id,
      onlyValid: true,
    });

    expect(result.results.length).toBe(1);
    expect(result.results[0].id).toBe(recentPrice.id);
  });
});
