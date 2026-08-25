import { db } from "@peated/server/db";
import { storePrices } from "@peated/server/db/schema";
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
    const included = await fixtures.StorePrice({
      bottleId: bottle.id,
      name: "Included direct Bottle price",
    });
    const excluded = await fixtures.StorePrice({
      bottleId: otherBottle.id,
      name: "Excluded other Bottle price",
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

  test("includes directly assigned price history", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    await fixtures.StorePrice({
      bottleId: bottle.id,
      name: "Direct history",
      price: 15_000,
    });

    const { results } = await routerClient.bottles.prices.history({
      bottle: bottle.id,
    });

    expect(results.map(({ avgPrice }) => avgPrice)).toEqual([20]);
  });

  test("rounds after calculating the precise per-milliliter price", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    await fixtures.StorePrice({
      bottleId: bottle.id,
      name: "Fractional per-milliliter history",
      price: 12_450,
      volume: 750,
    });

    const { results } = await routerClient.bottles.prices.history({
      bottle: bottle.id,
    });

    expect(results.map(({ avgPrice }) => avgPrice)).toEqual([17]);
  });

  test("filters by the currency recorded on each history row", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const price = await fixtures.StorePrice({
      bottleId: bottle.id,
      currency: "usd",
      name: "Listing with mixed-currency history",
    });
    await fixtures.StorePriceHistory({
      priceId: price.id,
      currency: "eur",
      date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      price: 15_000,
    });

    const { results } = await routerClient.bottles.prices.history({
      bottle: bottle.id,
      currency: "eur",
    });

    expect(results).toHaveLength(1);
    expect(results[0].avgPrice).toBe(20);
  });

  test("excludes hidden and older-than-one-year history", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const visiblePrice = await fixtures.StorePrice({
      bottleId: bottle.id,
      name: "Visible current history",
    });
    await fixtures.StorePriceHistory({
      priceId: visiblePrice.id,
      date: "2020-01-01",
    });
    await fixtures.StorePrice({
      bottleId: bottle.id,
      hidden: true,
      name: "Hidden current history",
    });

    const { results } = await routerClient.bottles.prices.history({
      bottle: bottle.id,
    });

    expect(results).toHaveLength(1);
    expect(results[0].date).not.toBe("2020-01-01");
  });
});
