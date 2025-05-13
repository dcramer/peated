import { db } from "@peated/server/db";
import { storePriceHistories, storePrices } from "@peated/server/db/schema";
import { routerClient } from "../router";

describe("GET /price-changes", () => {
  test("lists price changes", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    const price = await fixtures.StorePrice({
      bottleId: bottle.id,
      price: 10000, // $100
      updatedAt: new Date(),
    });
    await fixtures.StorePriceHistory({
      priceId: price.id,
      price: 5000, // $50
      date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week ago
    });

    const { results } = await routerClient.priceChangeList({});

    expect(results.length).toBe(1);
    expect(results[0].id).toEqual(bottle.id);
    expect(results[0].price).toEqual(10000);
    expect(results[0].previousPrice).toEqual(5000);
    expect(results[0].bottle.id).toEqual(bottle.id);
  });

  test("filters by query", async ({ fixtures }) => {
    const bottle1 = await fixtures.Bottle({ name: "Test Bottle 1" });
    const bottle2 = await fixtures.Bottle({ name: "Another Bottle" });

    const price1 = await fixtures.StorePrice({
      bottleId: bottle1.id,
      name: "Test Bottle 1",
      price: 10000,
      updatedAt: new Date(),
    });
    const price2 = await fixtures.StorePrice({
      bottleId: bottle2.id,
      name: "Another Bottle",
      price: 10000,
      updatedAt: new Date(),
    });

    await fixtures.StorePriceHistory({
      priceId: price1.id,
      price: 5000,
      date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    await fixtures.StorePriceHistory({
      priceId: price2.id,
      price: 5000,
      date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const { results } = await routerClient.priceChangeList({
      query: "Test",
    });

    expect(results.length).toBe(1);
    expect(results[0].bottle.name).toEqual("Test Bottle 1");
  });

  test("paginates results", async ({ fixtures }) => {
    const bottles = await Promise.all(
      Array.from({ length: 3 }).map((_, i) =>
        fixtures.Bottle({ name: `Bottle ${i}` }),
      ),
    );

    await Promise.all(
      bottles.map(async (bottle) => {
        const price = await fixtures.StorePrice({
          bottleId: bottle.id,
          price: 10000,
          updatedAt: new Date(),
        });
        await fixtures.StorePriceHistory({
          priceId: price.id,
          price: 5000,
          date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        });
      }),
    );

    const { results, rel } = await routerClient.priceChangeList({
      limit: 2,
    });

    expect(results.length).toBe(2);
    expect(rel.nextCursor).toBe(2);
    expect(rel.prevCursor).toBeNull();
  });
});
