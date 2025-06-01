import { db } from "@peated/server/db";
import { storePrices } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("POST /external-sites/:site/prices", () => {
  test("requires authentication", async () => {
    const err = await waitError(() =>
      routerClient.prices.createBatch({ site: "healthyspirits", prices: [] })
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("requires admin", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });

    const err = await waitError(() =>
      routerClient.prices.createBatch(
        { site: "healthyspirits", prices: [] },
        { context: { user } }
      )
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("returns error for non-existent site", async ({ fixtures }) => {
    const user = await fixtures.User({ admin: true });

    const err = await waitError(() =>
      routerClient.prices.createBatch(
        { site: "non-existent-site" as any, prices: [] },
        { context: { user } }
      )
    );
    expect(err).toMatchInlineSnapshot(`[Error: Input validation failed]`);
  });

  test("processes new price", async ({ fixtures }) => {
    const site = await fixtures.ExternalSite({ type: "totalwine" });
    const bottle = await fixtures.Bottle({
      name: "10-year-old",
      brandId: (await fixtures.Entity({ name: "Ardbeg" })).id,
    });
    expect(bottle.fullName).toBe("Ardbeg 10-year-old");

    const user = await fixtures.User({ admin: true });

    await routerClient.prices.createBatch(
      {
        site: site.type,
        prices: [
          {
            name: "Ardbeg 10-year-old",
            price: 9999,
            currency: "usd",
            volume: 750,
            url: "http://example.com",
            imageUrl: "http://example.com/foo.jpg",
          },
        ],
      },
      { context: { user } }
    );

    const prices = await db
      .select()
      .from(storePrices)
      .where(eq(storePrices.externalSiteId, site.id));
    expect(prices.length).toBe(1);
    expect(prices[0].bottleId).toBe(bottle.id);
    expect(prices[0].price).toBe(9999);
    expect(prices[0].name).toBe("Ardbeg 10-year-old");
    expect(prices[0].url).toBe("http://example.com");
  });

  test("processes existing price", async ({ fixtures }) => {
    const site = await fixtures.ExternalSite({ type: "totalwine" });
    const bottle = await fixtures.Bottle({
      name: "10-year-old",
      brandId: (await fixtures.Entity({ name: "Ardbeg" })).id,
    });
    expect(bottle.fullName).toBe("Ardbeg 10-year-old");
    const existingPrice = await fixtures.StorePrice({
      bottleId: bottle.id,
      externalSiteId: site.id,
    });
    expect(existingPrice.name).toBe(bottle.fullName);

    const user = await fixtures.User({ admin: true });

    await routerClient.prices.createBatch(
      {
        site: site.type,
        prices: [
          {
            name: "Ardbeg 10-year-old",
            price: 2999,
            currency: "usd",
            volume: 750,
            url: "http://example.com",
          },
        ],
      },
      { context: { user } }
    );

    const prices = await db
      .select()
      .from(storePrices)
      .where(eq(storePrices.externalSiteId, site.id));

    expect(prices.length).toBe(1);
    expect(prices[0].id).toBe(existingPrice.id);
    expect(prices[0].bottleId).toBe(bottle.id);
    expect(prices[0].price).toBe(2999);
    expect(prices[0].name).toBe("Ardbeg 10-year-old");
    expect(prices[0].url).toBe("http://example.com");
  });

  test("processes new price without bottle", async ({ fixtures }) => {
    const site = await fixtures.ExternalSite({ type: "totalwine" });
    const user = await fixtures.User({ admin: true });

    await routerClient.prices.createBatch(
      {
        site: site.type,
        prices: [
          {
            name: "Ardbeg 10-year-old",
            price: 2999,
            currency: "usd",
            volume: 750,
            url: "http://example.com",
          },
        ],
      },
      { context: { user } }
    );

    const prices = await db
      .select()
      .from(storePrices)
      .where(eq(storePrices.externalSiteId, site.id));
    expect(prices.length).toBe(1);
    expect(prices[0].bottleId).toBeNull();
    expect(prices[0].price).toBe(2999);
    expect(prices[0].name).toBe("Ardbeg 10-year-old");
    expect(prices[0].url).toBe("http://example.com");
  });

  test("does not unset bottle for existing price", async ({ fixtures }) => {
    const site = await fixtures.ExternalSite({ type: "totalwine" });
    const bottle = await fixtures.Bottle({
      name: "10-year-old",
      brandId: (await fixtures.Entity({ name: "Ardbeg" })).id,
    });
    expect(bottle.fullName).toBe("Ardbeg 10-year-old");
    const existingPrice = await fixtures.StorePrice({
      bottleId: bottle.id,
      name: "Ardbeg 10-year-old Single Malt",
      externalSiteId: site.id,
    });

    const user = await fixtures.User({ admin: true });

    await routerClient.prices.createBatch(
      {
        site: site.type,
        prices: [
          {
            name: "Ardbeg 10-year-old Single Malt",
            price: 2999,
            currency: "usd",
            volume: 750,
            url: "http://example.com",
          },
        ],
      },
      { context: { user } }
    );

    const prices = await db
      .select()
      .from(storePrices)
      .where(eq(storePrices.externalSiteId, site.id));

    expect(prices.length).toBe(1);
    expect(prices[0].id).toBe(existingPrice.id);
    expect(prices[0].bottleId).toBe(bottle.id);
    expect(prices[0].price).toBe(2999);
    expect(prices[0].name).toBe("Ardbeg 10-year-old Single Malt");
    expect(prices[0].url).toBe("http://example.com");
  });
});
