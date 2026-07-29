import { routerClient } from "@peated/server/orpc/router";

describe("GET /bottles/:bottle/prices", () => {
  test("includes prices older than a week by default", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    const recentPrice = await fixtures.StorePrice({
      externalSiteId: (
        await fixtures.ExternalSiteOrExisting({
          type: "astorwines",
        })
      ).id,
      bottleId: bottle.id,
    });
    const oldPrice = await fixtures.StorePrice({
      externalSiteId: (
        await fixtures.ExternalSiteOrExisting({
          type: "totalwine",
        })
      ).id,
      bottleId: bottle.id,
      updatedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    });

    const result = await routerClient.bottles.prices.list({
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
        await fixtures.ExternalSiteOrExisting({
          type: "astorwines",
        })
      ).id,
      bottleId: bottle.id,
    });
    const oldPrice = await fixtures.StorePrice({
      externalSiteId: (
        await fixtures.ExternalSiteOrExisting({
          type: "totalwine",
        })
      ).id,
      bottleId: bottle.id,
      updatedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    });

    const result = await routerClient.bottles.prices.list({
      bottle: bottle.id,
      onlyValid: true,
    });

    expect(result.results.length).toBe(1);
    expect(result.results[0].id).toBe(recentPrice.id);
  });

  test("lists only the selected direct Bottle", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    const otherBottle = await fixtures.Bottle();
    const site = await fixtures.ExternalSiteOrExisting();
    const firstDirect = await fixtures.StorePrice({
      bottleId: bottle.id,
      externalSiteId: site.id,
      name: "A direct Bottle price",
    });
    await fixtures.StorePrice({
      bottleId: otherBottle.id,
      externalSiteId: site.id,
      name: "B other Bottle price",
    });
    const secondDirect = await fixtures.StorePrice({
      bottleId: bottle.id,
      externalSiteId: site.id,
      name: "C second direct price",
    });

    const result = await routerClient.bottles.prices.list({
      bottle: bottle.id,
    });

    expect(result.results.map(({ id }) => id)).toEqual([
      firstDirect.id,
      secondDirect.id,
    ]);
    expect(
      result.results.every(
        ({ bottle: resultBottle }) => resultBottle?.id === bottle.id,
      ),
    ).toBe(true);
    expect(result.results.every((price) => !("target" in price))).toBe(true);
  });

  test("filters direct Bottle prices by validity", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    const current = await fixtures.StorePrice({
      bottleId: bottle.id,
      name: "Current direct listing",
    });
    await fixtures.StorePrice({
      bottleId: bottle.id,
      name: "Stale direct listing",
      updatedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    });

    const result = await routerClient.bottles.prices.list({
      bottle: bottle.id,
      onlyValid: true,
    });

    expect(result.results.map(({ id }) => id)).toEqual([current.id]);
  });
});
