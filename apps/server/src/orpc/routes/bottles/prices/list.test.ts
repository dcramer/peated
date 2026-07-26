import { db } from "@peated/server/db";
import { catalogTargets } from "@peated/server/db/schema";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";

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

  test("lists only the selected direct Bottle despite target evidence drift", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const otherBottle = await fixtures.Bottle();
    const target = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, bottle.id),
    });
    const otherTarget = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, otherBottle.id),
    });
    if (!target || !otherTarget) throw new Error("Missing target fixture");
    const site = await fixtures.ExternalSiteOrExisting();
    const directWithStaleEvidence = await fixtures.StorePrice({
      bottleId: bottle.id,
      targetId: otherTarget.id,
      externalSiteId: site.id,
      name: "A direct Bottle price",
    });
    await fixtures.StorePrice({
      bottleId: otherBottle.id,
      targetId: target.id,
      externalSiteId: site.id,
      name: "B stale target evidence",
    });
    const directWithoutTarget = await fixtures.StorePrice({
      bottleId: bottle.id,
      targetId: null,
      externalSiteId: site.id,
      name: "C alias-propagated price",
    });

    const result = await routerClient.bottles.prices.list({
      bottle: bottle.id,
    });

    expect(result.results.map(({ id }) => id)).toEqual([
      directWithStaleEvidence.id,
      directWithoutTarget.id,
    ]);
    expect(
      result.results.every(
        ({ bottle: resultBottle }) => resultBottle?.id === bottle.id,
      ),
    ).toBe(true);
    expect(result.results.every((price) => !("target" in price))).toBe(true);
  });

  test("filters direct Bottle prices by validity without target evidence", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const current = await fixtures.StorePrice({
      bottleId: bottle.id,
      targetId: null,
      name: "Current alias-propagated listing",
    });
    await fixtures.StorePrice({
      bottleId: bottle.id,
      targetId: null,
      name: "Stale alias-propagated listing",
      updatedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    });

    const result = await routerClient.bottles.prices.list({
      bottle: bottle.id,
      onlyValid: true,
    });

    expect(result.results.map(({ id }) => id)).toEqual([current.id]);
  });

  test("lists a Bottle without requiring a CatalogTarget", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.LegacyBottle();
    const price = await fixtures.StorePrice({
      bottleId: bottle.id,
      targetId: null,
    });

    const result = await routerClient.bottles.prices.list({
      bottle: bottle.id,
    });

    expect(result.results.map(({ id }) => id)).toEqual([price.id]);
    expect(result.results[0]?.bottle?.id).toBe(bottle.id);
  });
});
