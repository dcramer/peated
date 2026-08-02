import { db } from "@peated/server/db";
import {
  bottleTombstones,
  externalSites,
  storePrices,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

describe("GET /prices", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("lists prices with default parameters", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    const site = await fixtures.ExternalSiteOrExisting();
    const price1 = await fixtures.StorePrice({
      externalSiteId: site.id,
      name: "Price 1",
    });
    const price2 = await fixtures.StorePrice({
      externalSiteId: site.id,
      name: "Price 2",
    });

    const result = await routerClient.prices.list(
      {},
      { context: { user: admin } },
    );

    expect(result.results.length).toBe(2);
    expect(result.results[0].id).toBe(price1.id);
    expect(result.results[1].id).toBe(price2.id);
    expect(result.rel.nextCursor).toBeNull();
    expect(result.rel.prevCursor).toBeNull();
  });

  test("filters prices by site", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    const site1 = await fixtures.ExternalSiteOrExisting({
      type: "whiskyadvocate",
    });
    const price1 = await fixtures.StorePrice({ externalSiteId: site1.id });
    const site2 = await fixtures.ExternalSiteOrExisting({
      type: "healthyspirits",
    });
    await fixtures.StorePrice({ externalSiteId: site2.id }); // Different site

    const result = await routerClient.prices.list(
      { site: "whiskyadvocate" },
      { context: { user: admin } },
    );

    expect(result.results.length).toBe(1);
    expect(result.results[0].id).toBe(price1.id);
  });

  test("treats bottleId as authoritative for unknown filtering", async ({
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });
    const bottle = await fixtures.Bottle();
    const site = await fixtures.ExternalSiteOrExisting();
    await fixtures.StorePrice({
      bottleId: bottle.id,
      externalSiteId: site.id,
      name: "Direct listing",
    });
    const unresolved = await fixtures.StorePrice({
      bottleId: null,
      externalSiteId: site.id,
      name: "Unresolved listing",
    });

    const result = await routerClient.prices.list(
      { onlyUnknown: true },
      { context: { user: admin } },
    );

    expect(result.results.map(({ id }) => id)).toEqual([unresolved.id]);
    expect(result.results[0]?.bottle).toBeNull();
  });

  test("returns direct Bottle identity and nullable unresolved listings", async ({
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });
    const firstBottle = await fixtures.Bottle({ name: "First price" });
    const secondBottle = await fixtures.Bottle({ name: "Second price" });
    const site = await fixtures.ExternalSiteOrExisting();
    const first = await fixtures.StorePrice({
      bottleId: firstBottle.id,
      externalSiteId: site.id,
      name: "A first",
    });
    const second = await fixtures.StorePrice({
      bottleId: secondBottle.id,
      externalSiteId: site.id,
      name: "B second",
    });
    const unresolved = await fixtures.StorePrice({
      bottleId: null,
      externalSiteId: site.id,
      name: "C unresolved",
    });

    const result = await routerClient.prices.list(
      {},
      { context: { user: admin } },
    );
    const byId = Object.fromEntries(
      result.results.map((price) => [price.id, price]),
    );

    expect(byId[first.id]?.bottle?.id).toBe(firstBottle.id);
    expect(byId[second.id]?.bottle?.id).toBe(secondBottle.id);
    expect(byId[unresolved.id]?.bottle).toBeNull();
    expect(result.results.every((price) => !("target" in price))).toBe(true);
  });

  test("fails closed for a retired authoritative Bottle", async ({
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });
    const retired = await fixtures.Bottle();
    const replacement = await fixtures.Bottle();
    const price = await fixtures.StorePrice({ bottleId: retired.id });
    await db.insert(bottleTombstones).values({
      bottleId: retired.id,
      newBottleId: replacement.id,
    });

    await expect(
      routerClient.prices.list({}, { context: { user: admin } }),
    ).rejects.toThrow(
      `Store price ${price.id} references missing Bottle ${retired.id}.`,
    );
  });

  test("filters prices by query", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    const site = await fixtures.ExternalSiteOrExisting();
    const price1 = await fixtures.StorePrice({
      externalSiteId: site.id,
      name: "Unique Whiskey",
    });
    await fixtures.StorePrice({
      externalSiteId: site.id,
      name: "Common Bourbon",
    });

    const result = await routerClient.prices.list(
      { query: "Unique" },
      { context: { user: admin } },
    );

    expect(result.results.length).toBe(1);
    expect(result.results[0].id).toBe(price1.id);
  });

  test("requires admin permission", async ({ fixtures }) => {
    const user = await fixtures.User({ admin: false });

    const err = await waitError(
      routerClient.prices.list({}, { context: { user } }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("excludes hidden prices", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    const site = await fixtures.ExternalSiteOrExisting();
    await fixtures.StorePrice({ hidden: true, externalSiteId: site.id });
    const visiblePrice = await fixtures.StorePrice({
      hidden: false,
      externalSiteId: site.id,
    });

    const result = await routerClient.prices.list(
      {},
      { context: { user: admin } },
    );

    expect(result.results.length).toBe(1);
    expect(result.results[0].id).toBe(visiblePrice.id);
  });

  test("includes prices older than a week by default", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    const recentPrice = await fixtures.StorePrice({
      externalSiteId: (
        await fixtures.ExternalSiteOrExisting({
          type: "astorwines",
        })
      ).id,
    });
    const oldPrice = await fixtures.StorePrice({
      externalSiteId: (
        await fixtures.ExternalSiteOrExisting({
          type: "totalwine",
        })
      ).id,
      updatedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    });

    const result = await routerClient.prices.list(
      {},
      { context: { user: admin } },
    );

    expect(result.results.length).toBe(2);
    expect(result.results.map((p) => p.id)).toContain(recentPrice.id);
    expect(result.results.map((p) => p.id)).toContain(oldPrice.id);
  });

  test("excludes prices older than a week when onlyValid is true", async ({
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });
    const recentPrice = await fixtures.StorePrice({
      externalSiteId: (
        await fixtures.ExternalSiteOrExisting({
          type: "astorwines",
        })
      ).id,
    });
    const oldPrice = await fixtures.StorePrice({
      externalSiteId: (
        await fixtures.ExternalSiteOrExisting({
          type: "totalwine",
        })
      ).id,
      updatedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    });

    const result = await routerClient.prices.list(
      { onlyValid: true },
      { context: { user: admin } },
    );

    expect(result.results.length).toBe(1);
    expect(result.results[0].id).toBe(recentPrice.id);
  });
});
