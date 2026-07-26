import { db } from "@peated/server/db";
import { catalogTargets, storePrices } from "@peated/server/db/schema";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";

describe("GET /bottles/:bottle/price-history", () => {
  test("lists bottle history", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    await fixtures.StorePrice({
      bottleId: bottle.id,
    });

    const { results } = await routerClient.bottles.prices.history({
      bottle: bottle.id,
    });

    expect(results.length).toBe(1);
  });

  test("aggregates history only for the selected direct Bottle", async ({
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
    const included = await fixtures.StorePrice({
      bottleId: bottle.id,
      targetId: otherTarget.id,
      name: "Included direct Bottle price",
    });
    const excluded = await fixtures.StorePrice({
      bottleId: otherBottle.id,
      targetId: target.id,
      name: "Excluded stale target evidence",
    });
    await db
      .update(storePrices)
      .set({ updatedAt: new Date() })
      .where(eq(storePrices.id, included.id));
    await fixtures.StorePriceHistory({
      priceId: included.id,
      price: 12_300,
      date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    await fixtures.StorePriceHistory({
      priceId: excluded.id,
      price: 99_900,
      date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const { results } = await routerClient.bottles.prices.history({
      bottle: bottle.id,
    });

    expect(results.map(({ avgPrice }) => avgPrice)).toContain(16);
    expect(results.map(({ avgPrice }) => avgPrice)).not.toContain(133);
  });

  test("includes alias-propagated history without target evidence", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    await fixtures.StorePrice({
      bottleId: bottle.id,
      targetId: null,
      name: "Alias-propagated history",
      price: 15_000,
    });

    const { results } = await routerClient.bottles.prices.history({
      bottle: bottle.id,
    });

    expect(results.map(({ avgPrice }) => avgPrice)).toEqual([20]);
  });
});
