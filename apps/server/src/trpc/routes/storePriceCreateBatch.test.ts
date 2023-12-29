import { db } from "@peated/server/db";
import { storePrices } from "@peated/server/db/schema";
import * as Fixtures from "@peated/server/lib/test/fixtures";
import { eq } from "drizzle-orm";
import { appRouter } from "../router";

test("requires admin", async () => {
  const caller = appRouter.createCaller({
    user: await Fixtures.User({ mod: true }),
  });
  expect(() =>
    caller.storePriceCreateBatch({ store: 1, prices: [] }),
  ).rejects.toThrowError(/UNAUTHORIZED/);
});

test("processes new price", async () => {
  const store = await Fixtures.Store({ type: "totalwines" });
  const bottle = await Fixtures.Bottle({
    name: "10-year-old",
    brandId: (await Fixtures.Entity({ name: "Ardbeg" })).id,
  });
  expect(bottle.fullName).toBe("Ardbeg 10-year-old");

  const caller = appRouter.createCaller({
    user: await Fixtures.User({ admin: true }),
  });
  await caller.storePriceCreateBatch({
    store: store.id,
    prices: [
      {
        name: "Ardbeg 10-year-old",
        price: 9999,
        volume: 750,
        url: "http://example.com",
      },
    ],
  });

  const prices = await db
    .select()
    .from(storePrices)
    .where(eq(storePrices.storeId, store.id));
  expect(prices.length).toBe(1);
  expect(prices[0].bottleId).toBe(bottle.id);
  expect(prices[0].price).toBe(9999);
  expect(prices[0].name).toBe("Ardbeg 10-year-old");
  expect(prices[0].url).toBe("http://example.com");
});

test("processes existing price", async () => {
  const store = await Fixtures.Store({ type: "totalwines" });
  const bottle = await Fixtures.Bottle({
    name: "10-year-old",
    brandId: (await Fixtures.Entity({ name: "Ardbeg" })).id,
  });
  expect(bottle.fullName).toBe("Ardbeg 10-year-old");
  const existingPrice = await Fixtures.StorePrice({
    bottleId: bottle.id,
    storeId: store.id,
  });
  expect(existingPrice.name).toBe(bottle.fullName);

  const caller = appRouter.createCaller({
    user: await Fixtures.User({ admin: true }),
  });
  await caller.storePriceCreateBatch({
    store: store.id,
    prices: [
      {
        name: "Ardbeg 10-year-old",
        price: 2999,
        volume: 750,
        url: "http://example.com",
      },
    ],
  });

  const prices = await db
    .select()
    .from(storePrices)
    .where(eq(storePrices.storeId, store.id));

  expect(prices.length).toBe(1);
  expect(prices[0].id).toBe(existingPrice.id);
  expect(prices[0].bottleId).toBe(bottle.id);
  expect(prices[0].price).toBe(2999);
  expect(prices[0].name).toBe("Ardbeg 10-year-old");
  expect(prices[0].url).toBe("http://example.com");
});

test("processes new price without bottle", async () => {
  const store = await Fixtures.Store({ type: "totalwines" });

  const caller = appRouter.createCaller({
    user: await Fixtures.User({ admin: true }),
  });
  await caller.storePriceCreateBatch({
    store: store.id,
    prices: [
      {
        name: "Ardbeg 10-year-old",
        price: 2999,
        volume: 750,
        url: "http://example.com",
      },
    ],
  });

  const prices = await db
    .select()
    .from(storePrices)
    .where(eq(storePrices.storeId, store.id));
  expect(prices.length).toBe(1);
  expect(prices[0].bottleId).toBeNull();
  expect(prices[0].price).toBe(2999);
  expect(prices[0].name).toBe("Ardbeg 10-year-old");
  expect(prices[0].url).toBe("http://example.com");
});
