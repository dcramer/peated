import { db } from "@peated/server/db";
import { storePrices } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("PATCH /prices/:price", () => {
  test("requires mod role", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: false });
    const price = await fixtures.StorePrice();

    const err = await waitError(
      routerClient.prices.update(
        { price: price.id, hidden: true },
        { context: { user } }
      )
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("updates hidden status", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const price = await fixtures.StorePrice({ hidden: false });

    const newPriceData = await routerClient.prices.update(
      { price: price.id, hidden: true },
      { context: { user } }
    );

    const [updatedPrice] = await db
      .select()
      .from(storePrices)
      .where(eq(storePrices.id, price.id));
    expect(updatedPrice.hidden).toBe(true);
  });

  test("returns NOT_FOUND for non-existent price", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });

    const err = await waitError(
      routerClient.prices.update(
        { price: 999999, hidden: true },
        { context: { user } }
      )
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
      { context: { user } }
    );

    expect(newPriceData.id).toBe(price.id);
  });
});
