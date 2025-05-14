import { routerClient } from "@peated/server/orpc/router";

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
});
