import {
  normalizeBottle,
  normalizeBottleAliasKey,
} from "@peated/bottle-classifier/normalize";
import { db } from "@peated/server/db";
import { bottleAliases, reviews, storePrices } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import * as workerClient from "@peated/server/worker/client";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@peated/server/worker/client", () => ({
  pushJob: vi.fn(),
  pushUniqueJob: vi.fn(),
}));

describe("POST /external-sites/:site/prices", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("requires authentication", async () => {
    const err = await waitError(() =>
      routerClient.prices.createBatch({ site: "healthyspirits", prices: [] }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("requires admin", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });

    const err = await waitError(() =>
      routerClient.prices.createBatch(
        { site: "healthyspirits", prices: [] },
        { context: { user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("returns error for non-existent site", async ({ fixtures }) => {
    const user = await fixtures.User({ admin: true });

    const err = await waitError(() =>
      routerClient.prices.createBatch(
        { site: "non-existent-site" as any, prices: [] },
        { context: { user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Input validation failed]`);
  });

  test("processes new price", async ({ fixtures }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
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
      { context: { user } },
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
    const alias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, "Ardbeg 10-year-old"),
    });
    expect(alias).toMatchObject({
      bottleId: bottle.id,
      assignmentSource: "source_approved",
      assignedById: user.id,
    });
    expect(workerClient.pushJob).toHaveBeenCalledWith("CapturePriceImage", {
      priceId: prices[0].id,
      imageUrl: "http://example.com/foo.jpg",
    });
    expect(workerClient.pushUniqueJob).not.toHaveBeenCalled();
  });

  test("processes existing price", async ({ fixtures }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
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
      { context: { user } },
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

  test("preserves an exact release target during ingestion", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const bottle = await fixtures.Bottle({
      name: "Reserve",
      brandId: (await fixtures.Entity({ name: "Ardbeg" })).id,
    });
    const release = await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "Batch 1",
      abv: 46,
    });
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      releaseId: release.id,
      name: release.fullName,
    });
    const user = await fixtures.User({ admin: true });

    await routerClient.prices.createBatch(
      {
        site: site.type,
        prices: [
          {
            name: release.fullName,
            price: 4999,
            currency: "usd",
            volume: 750,
            url: "http://example.com/release",
          },
        ],
      },
      { context: { user } },
    );

    const [price] = await db
      .select()
      .from(storePrices)
      .where(eq(storePrices.externalSiteId, site.id));

    const normalizedReleaseName = normalizeBottle({
      name: release.fullName,
    }).name;

    expect(price).toMatchObject({
      bottleId: bottle.id,
      releaseId: release.id,
      name: normalizedReleaseName,
    });
  });

  test("processes new price without bottle", async ({ fixtures }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
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
      { context: { user } },
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
    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, "Ardbeg 10-year-old"),
      }),
    ).toBeUndefined();
    expect(workerClient.pushJob).not.toHaveBeenCalled();
    expect(workerClient.pushUniqueJob).toHaveBeenCalledWith(
      "ResolveStorePriceBottle",
      {
        priceId: prices[0].id,
      },
    );
  });

  test("uses identity-preserving alias keys as exact matches", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
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
            name: "Ardbeg 10 years old",
            price: 3999,
            currency: "usd",
            volume: 750,
            url: "http://example.com/normalized-alias",
          },
        ],
      },
      { context: { user } },
    );

    const prices = await db
      .select()
      .from(storePrices)
      .where(eq(storePrices.externalSiteId, site.id));

    expect(prices.length).toBe(1);
    expect(prices[0].bottleId).toBe(bottle.id);
    expect(prices[0].releaseId).toBeNull();
    expect(prices[0].name).toBe("Ardbeg 10-year-old");
    expect(workerClient.pushUniqueJob).not.toHaveBeenCalled();
  });

  test("falls back to existing raw aliases for legacy exact matches", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const bottle = await fixtures.Bottle({
      name: "10-year-old",
      brandId: (await fixtures.Entity({ name: "Ardbeg" })).id,
    });
    const rawName = "Ardbeg 10 years old";
    const aliasKey = normalizeBottleAliasKey(rawName);
    expect(aliasKey).not.toBe(rawName);
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: rawName,
    });
    const rawReview = await fixtures.Review({
      bottleId: null,
      releaseId: null,
      name: rawName,
    });
    const user = await fixtures.User({ admin: true });

    await routerClient.prices.createBatch(
      {
        site: site.type,
        prices: [
          {
            name: rawName,
            price: 3999,
            currency: "usd",
            volume: 750,
            url: "http://example.com/legacy-raw-alias",
          },
        ],
      },
      { context: { user } },
    );

    const [price] = await db
      .select()
      .from(storePrices)
      .where(eq(storePrices.externalSiteId, site.id));
    const alias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, aliasKey),
    });
    const updatedRawReview = await db.query.reviews.findFirst({
      where: eq(reviews.id, rawReview.id),
    });

    expect(price.bottleId).toBe(bottle.id);
    expect(updatedRawReview).toMatchObject({
      bottleId: bottle.id,
      releaseId: null,
    });
    expect(alias).toMatchObject({
      bottleId: bottle.id,
      assignmentSource: "source_approved",
      assignedById: user.id,
    });
    expect(workerClient.pushUniqueJob).not.toHaveBeenCalled();
  });

  test("does not use lossy normalized listing names as exact matches", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const bottle = await fixtures.Bottle({
      name: "Distillers Edition",
      brandId: (await fixtures.Entity({ name: "Lagavulin" })).id,
    });
    expect(bottle.fullName).toBe("Lagavulin Distillers Edition");
    const user = await fixtures.User({ admin: true });

    await routerClient.prices.createBatch(
      {
        site: site.type,
        prices: [
          {
            name: "Lagavulin Distillers Edition 2011 Release",
            price: 3999,
            currency: "usd",
            volume: 750,
            url: "http://example.com/lossy-normalized-alias",
          },
        ],
      },
      { context: { user } },
    );

    const [price] = await db
      .select()
      .from(storePrices)
      .where(eq(storePrices.externalSiteId, site.id));

    expect(price.bottleId).toBeNull();
    expect(price.releaseId).toBeNull();
    expect(price.name).toBe(bottle.fullName);
    expect(workerClient.pushUniqueJob).toHaveBeenCalledWith(
      "ResolveStorePriceBottle",
      {
        priceId: price.id,
      },
    );
  });

  test("writes the same accepted alias key used for lookup", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const bottle = await fixtures.Bottle({
      name: "10-year-old",
      brandId: (await fixtures.Entity({ name: "Ardbeg" })).id,
    });
    const rawName = "Ardbeg 10 years old Whisky";
    const aliasKey = normalizeBottleAliasKey(rawName);
    expect(aliasKey).not.toBe(rawName);

    await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: aliasKey,
    });
    const user = await fixtures.User({ admin: true });

    await routerClient.prices.createBatch(
      {
        site: site.type,
        prices: [
          {
            name: rawName,
            price: 3999,
            currency: "usd",
            volume: 750,
            url: "http://example.com/raw-alias",
          },
        ],
      },
      { context: { user } },
    );

    const alias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, aliasKey),
    });
    expect(alias).toMatchObject({
      bottleId: bottle.id,
      assignmentSource: "source_approved",
      assignedById: user.id,
    });
    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, rawName),
      }),
    ).toBeUndefined();
    expect(workerClient.pushUniqueJob).not.toHaveBeenCalled();
  });

  test("does not unset bottle for existing price", async ({ fixtures }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
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
      { context: { user } },
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
