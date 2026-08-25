import { eq } from "drizzle-orm";
import { db } from "../index";
import { storePriceHistories, storePrices } from "./stores";

describe("Store price constraints", () => {
  test("rejects non-positive listing facts", async ({ fixtures }) => {
    const listing = await fixtures.StorePrice();

    await expect(
      db
        .update(storePrices)
        .set({ price: 0 })
        .where(eq(storePrices.id, listing.id)),
    ).rejects.toThrow(/store_price_price_check/);
    await expect(
      db
        .update(storePrices)
        .set({ volume: 0 })
        .where(eq(storePrices.id, listing.id)),
    ).rejects.toThrow(/store_price_volume_check/);
  });

  test("rejects non-positive history facts", async ({ fixtures }) => {
    const listing = await fixtures.StorePrice();

    await expect(
      db
        .update(storePriceHistories)
        .set({ price: 0 })
        .where(eq(storePriceHistories.priceId, listing.id)),
    ).rejects.toThrow(/store_price_history_price_check/);
    await expect(
      db
        .update(storePriceHistories)
        .set({ volume: 0 })
        .where(eq(storePriceHistories.priceId, listing.id)),
    ).rejects.toThrow(/store_price_history_volume_check/);
  });
});
