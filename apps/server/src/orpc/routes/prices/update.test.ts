import { db } from "@peated/server/db";
import { storePriceHistories, storePrices } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { asc, eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("PATCH /prices/:price", () => {
  test("requires mod role", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: false });
    const price = await fixtures.StorePrice();

    const err = await waitError(
      routerClient.prices.update(
        { price: price.id, hidden: true },
        { context: { user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("updates hidden status", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const price = await fixtures.StorePrice({ hidden: false });

    const newPriceData = await routerClient.prices.update(
      { price: price.id, hidden: true },
      { context: { user } },
    );

    const [updatedPrice] = await db
      .select()
      .from(storePrices)
      .where(eq(storePrices.id, price.id));
    expect(updatedPrice.hidden).toBe(true);
  });

  test("corrects the volume and the listing's price history", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const price = await fixtures.StorePrice({
      volume: 750,
      sourceFingerprint: "smws-750",
    });
    await fixtures.StorePriceHistory({
      priceId: price.id,
      volume: 750,
      date: "2026-01-05",
    });

    const result = await routerClient.prices.update(
      { price: price.id, volume: 700 },
      { context: { user } },
    );
    expect(result.volume).toBe(700);

    const [updatedPrice] = await db
      .select()
      .from(storePrices)
      .where(eq(storePrices.id, price.id));
    expect(updatedPrice.volume).toBe(700);
    expect(updatedPrice.sourceFingerprint).toBeNull();

    const history = await db
      .select({ volume: storePriceHistories.volume })
      .from(storePriceHistories)
      .where(eq(storePriceHistories.priceId, price.id));
    expect(history).toHaveLength(2);
    expect(history.every((row) => row.volume === 700)).toBe(true);
  });

  test("keeps a history row that already has the corrected volume that day", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const price = await fixtures.StorePrice({ volume: 750 });
    await fixtures.StorePriceHistory({
      priceId: price.id,
      volume: 750,
      date: "2026-01-05",
    });
    await fixtures.StorePriceHistory({
      priceId: price.id,
      volume: 700,
      date: "2026-01-05",
    });

    await routerClient.prices.update(
      { price: price.id, volume: 700 },
      { context: { user } },
    );

    const history = await db
      .select({
        volume: storePriceHistories.volume,
        date: storePriceHistories.date,
      })
      .from(storePriceHistories)
      .where(eq(storePriceHistories.priceId, price.id))
      .orderBy(asc(storePriceHistories.date), asc(storePriceHistories.volume));
    expect(history.filter((row) => row.date === "2026-01-05")).toEqual([
      { volume: 700, date: "2026-01-05" },
      { volume: 750, date: "2026-01-05" },
    ]);
    expect(history.filter((row) => row.date !== "2026-01-05")).toEqual([
      { volume: 700, date: expect.any(String) },
    ]);
  });

  test("rejects a volume that is not a bottle size", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const price = await fixtures.StorePrice({ volume: 750 });

    const err = await waitError(
      routerClient.prices.update(
        { price: price.id, volume: 720 },
        { context: { user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Input validation failed]`);
  });

  test("returns NOT_FOUND for non-existent price", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });

    const err = await waitError(
      routerClient.prices.update(
        { price: 999999, hidden: true },
        { context: { user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Price not found.]`);
  });

  test("returns existing price if no data is sent", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const price = await fixtures.StorePrice({
      price: 10000,
      hidden: false,
    });

    const newPriceData = await routerClient.prices.update(
      { price: price.id }, // no actual update data
      { context: { user } },
    );

    expect(newPriceData.id).toBe(price.id);
  });
});
