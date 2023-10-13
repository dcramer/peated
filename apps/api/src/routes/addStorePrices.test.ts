import { db } from "@peated/shared/db";
import { storePrices } from "@peated/shared/db/schema";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import buildFastify from "../app";
import * as Fixtures from "../lib/test/fixtures";
import { findBottle } from "./addStorePrices";

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildFastify();

  return async () => {
    await app.close();
  };
});

test("requires admin", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/stores/1/prices",
    payload: [],
    headers: await Fixtures.AuthenticatedHeaders({ mod: true }),
  });

  expect(response).toRespondWith(403);
});

test("processes new price", async () => {
  const store = await Fixtures.Store({ type: "totalwines" });
  const bottle = await Fixtures.Bottle({
    name: "10-year-old",
    brandId: (await Fixtures.Entity({ name: "Ardbeg" })).id,
  });
  expect(bottle.fullName).toBe("Ardbeg 10-year-old");

  const response = await app.inject({
    method: "POST",
    url: `/stores/${store.id}/prices`,
    payload: [
      {
        name: "Ardbeg 10-year-old",
        price: 9999,
        volume: 750,
        url: "http://example.com",
      },
    ],
    headers: await Fixtures.AuthenticatedHeaders({ admin: true }),
  });

  expect(response).toRespondWith(201);

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

  const response = await app.inject({
    method: "POST",
    url: `/stores/${store.id}/prices`,
    payload: [
      {
        name: "Ardbeg 10-year-old",
        price: 2999,
        volume: 750,
        url: "http://example.com",
      },
    ],
    headers: await Fixtures.AuthenticatedHeaders({ admin: true }),
  });

  expect(response).toRespondWith(201);

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

  const response = await app.inject({
    method: "POST",
    url: `/stores/${store.id}/prices`,
    payload: [
      {
        name: "Ardbeg 10-year-old",
        price: 2999,
        volume: 750,
        url: "http://example.com",
      },
    ],
    headers: await Fixtures.AuthenticatedHeaders({ admin: true }),
  });

  expect(response).toRespondWith(201);

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

test("findBottle matches exact", async () => {
  const bottle = await Fixtures.Bottle();
  const result = await findBottle(bottle.fullName);
  expect(result?.id).toBe(bottle.id);
});

test("findBottle matches fullName as prefix", async () => {
  const bottle = await Fixtures.Bottle();
  const result = await findBottle(bottle.fullName + " Single Grain");
  expect(result?.id).toBe(bottle.id);
});

test("findBottle matches partial fullName", async () => {
  const brand = await Fixtures.Entity({ name: "The Macallan" });
  const bottle = await Fixtures.Bottle({
    brandId: brand.id,
    name: "12-year-old Double Cask",
  });
  const result = await findBottle("The Macallan 12-year-old");
  expect(result?.id).toBe(bottle.id);
});

test("findBottle doesnt match random junk", async () => {
  const bottle = await Fixtures.Bottle();
  const result = await findBottle("No Chance");
  expect(result?.id).toBe(undefined);
});
