import { db } from "@peated/server/db";
import { getPostgresConnectionConfig } from "@peated/server/db/connection";
import {
  bottleAliases,
  bottleBarcodes,
  bottleTombstones,
  reviews,
  storePriceHistories,
  storePrices,
} from "@peated/server/db/schema";
import { getPeatedSystemActor } from "@peated/server/lib/actors";
import { createStorePricesAsPeated } from "@peated/server/lib/createStorePrices";
import {
  normalizeBottle,
  normalizeBottleAliasKey,
} from "@peated/server/lib/normalize";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import * as workerClient from "@peated/server/worker/client";
import { eq } from "drizzle-orm";
import pg from "pg";
import { beforeEach, describe, expect, test, vi } from "vitest";

const { Client } = pg;
type NodePgClient = InstanceType<typeof Client>;

async function waitForSessionBlockedBy(
  client: NodePgClient,
  blockerPid: number,
): Promise<void> {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const result = await client.query<{ blocked: boolean }>(
      `SELECT EXISTS (
        SELECT 1
        FROM pg_stat_activity
        WHERE $1 = ANY(pg_blocking_pids(pid))
      ) AS blocked`,
      [blockerPid],
    );
    if (result.rows[0]?.blocked) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Timed out waiting for expected database lock.");
}

vi.mock("@peated/server/worker/client", () => ({
  pushJob: vi.fn(),
  pushUniqueJob: vi.fn(),
}));

describe("POST /external-sites/:site/prices", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("requires authentication", async () => {
    const error = await waitError(() =>
      routerClient.prices.createBatch({ site: "healthyspirits", prices: [] }),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("requires admin", async ({ fixtures }) => {
    const moderator = await fixtures.User({ mod: true });

    const error = await waitError(() =>
      routerClient.prices.createBatch(
        { site: "healthyspirits", prices: [] },
        { context: { user: moderator } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("rejects invalid site input", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });

    const error = await waitError(() =>
      routerClient.prices.createBatch(
        { site: "not-a-site" as never, prices: [] },
        { context: { user: admin } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Input validation failed]`);
  });

  test("processes a mixed batch with direct and unresolved Bottle identity", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const admin = await fixtures.User({ admin: true });
    const brand = await fixtures.Entity({ name: "Ardbeg" });
    const bottle = await fixtures.Bottle({
      name: "10-year-old",
      brandId: brand.id,
    });
    const imageUrl = "https://example.com/images/ardbeg.jpg";

    await routerClient.prices.createBatch(
      {
        site: site.type,
        prices: [
          {
            name: bottle.fullName,
            price: 9_999,
            currency: "usd",
            volume: 750,
            url: "https://example.com/prices/ardbeg",
            imageUrl,
          },
          {
            name: "Unresolved Batch Listing",
            price: 7_999,
            currency: "usd",
            volume: 500,
            url: "https://example.com/prices/unresolved",
          },
        ],
      },
      { context: { user: admin } },
    );

    const prices = await db.query.storePrices.findMany({
      where: eq(storePrices.externalSiteId, site.id),
    });
    const matched = prices.find(({ name }) => name === bottle.fullName);
    const unresolved = prices.find(({ bottleId }) => bottleId === null);
    expect(matched).toMatchObject({
      bottleId: bottle.id,
      price: 9_999,
    });
    expect(unresolved).toMatchObject({
      bottleId: null,
      price: 7_999,
    });
    expect(await db.select().from(storePriceHistories)).toHaveLength(2);
    expect(workerClient.pushJob).toHaveBeenCalledWith("CapturePriceImage", {
      priceId: matched!.id,
      imageUrl,
    });
    expect(workerClient.pushUniqueJob).toHaveBeenCalledWith(
      "IndexBottleSearchVectors",
      { bottleId: bottle.id },
    );
    expect(workerClient.pushUniqueJob).toHaveBeenCalledWith(
      "ResolveStorePriceBottle",
      { priceId: unresolved!.id },
    );
  });

  test("uses a directly assigned Bottle alias", async ({ fixtures }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const admin = await fixtures.User({ admin: true });
    const bottle = await fixtures.Bottle({
      name: "Direct Price Bottle",
    });
    const aliasName = "Direct Price Alias";
    await fixtures.BottleAlias({
      name: aliasName,
      bottleId: bottle.id,
    });

    await routerClient.prices.createBatch(
      {
        site: site.type,
        prices: [
          {
            name: aliasName,
            price: 8_999,
            currency: "usd",
            volume: 750,
            url: "https://example.com/prices/stale-target",
          },
        ],
      },
      { context: { user: admin } },
    );

    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.externalSiteId, site.id),
      }),
    ).toMatchObject({
      bottleId: bottle.id,
    });
    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, normalizeBottleAliasKey(aliasName)),
      }),
    ).toMatchObject({
      bottleId: bottle.id,
    });
  });

  test("worker ingestion attributes alias approval to Peated", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const bottle = await fixtures.Bottle({ name: "System Price Bottle" });
    const alias = await fixtures.BottleAlias({
      name: "System Price Alias",
      bottleId: bottle.id,
    });
    const systemActor = await getPeatedSystemActor();
    expect(alias.assignedByActorId).not.toBe(systemActor.id);

    await createStorePricesAsPeated({
      site: site.type,
      prices: [
        {
          name: alias.name,
          price: 8_999,
          currency: "usd",
          volume: 750,
          url: "https://example.com/prices/system-attribution",
        },
      ],
    });

    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, alias.name),
      }),
    ).toMatchObject({
      bottleId: bottle.id,
      assignmentSource: "source_approved",
      assignedByActorId: systemActor.id,
    });
  });

  test("persists and refreshes normalized source identity", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({
      type: "douglaslaing",
    });
    const listing = {
      name: "The Gauldrons Eclipse",
      price: 7_200,
      currency: "usd" as const,
      volume: 700,
      url: "https://www.douglaslaing.com/en-us/products/the-gauldrons-eclipse",
      sourceBottleIdentity: {
        brand: "The Gauldrons",
        expression: "Eclipse – Finished in Orange Wine Casks",
        category: "blend" as const,
        abv: 52.9,
      },
    };

    await createStorePricesAsPeated({
      site: site.type,
      prices: [listing],
    });
    await createStorePricesAsPeated({
      site: site.type,
      prices: [
        {
          ...listing,
          sourceBottleIdentity: { ...listing.sourceBottleIdentity, abv: 53 },
        },
      ],
    });
    await createStorePricesAsPeated({
      site: site.type,
      prices: [
        {
          ...listing,
          price: 7_300,
          sourceBottleIdentity: undefined,
        },
      ],
    });

    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.externalSiteId, site.id),
      }),
    ).toMatchObject({
      sourceBottleIdentity: {
        brand: "The Gauldrons",
        bottler: null,
        expression: "Eclipse – Finished in Orange Wine Casks",
        category: "blend",
        abv: 53,
        release_year: null,
      },
    });
  });

  test("tracks a retailer product across URL changes and preserves its barcode claim", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const listing = {
      externalProductId: "retailer-sku-123",
      barcode: "0 36602-30197 9",
      name: "Generic Single Malt Whisky",
      price: 7_200,
      currency: "usd" as const,
      volume: 750,
      url: "https://example.com/products/old-slug",
    };

    await createStorePricesAsPeated({ site: site.type, prices: [listing] });
    await createStorePricesAsPeated({
      site: site.type,
      prices: [
        {
          ...listing,
          price: 7_500,
          url: "https://example.com/products/new-slug",
        },
      ],
    });

    const prices = await db.query.storePrices.findMany({
      where: eq(storePrices.externalSiteId, site.id),
    });
    expect(prices).toHaveLength(1);
    expect(prices[0]).toMatchObject({
      externalProductId: "retailer-sku-123",
      barcode: "036602301979",
      bottleId: null,
      price: 7_500,
      url: "https://example.com/products/new-slug",
    });
  });

  test("keeps distinct generic listings instead of merging by title and volume", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const common = {
      name: "Single Malt Whisky",
      price: 7_200,
      currency: "usd" as const,
      volume: 750,
    };

    await createStorePricesAsPeated({
      site: site.type,
      prices: [
        {
          ...common,
          externalProductId: "release-1",
          url: "https://example.com/products/release-1",
        },
        {
          ...common,
          externalProductId: "release-2",
          url: "https://example.com/products/release-2",
        },
      ],
    });

    await expect(
      db.query.storePrices.findMany({
        where: eq(storePrices.externalSiteId, site.id),
      }),
    ).resolves.toHaveLength(2);
  });

  test("uses an approved barcode only for the matching package volume", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const bottle = await fixtures.Bottle({ name: "Barcode Bottle" });
    const systemActor = await getPeatedSystemActor();
    await db.insert(bottleBarcodes).values({
      bottleId: bottle.id,
      value: "036602301979",
      gtin14: "00036602301979",
      volume: 750,
      createdByActorId: systemActor.id,
    });

    await createStorePricesAsPeated({
      site: site.type,
      prices: [
        {
          externalProductId: "matching-volume",
          barcode: "036602301979",
          name: "Generic Retailer Title",
          price: 7_200,
          currency: "usd",
          volume: 750,
          url: "https://example.com/products/matching-volume",
        },
        {
          externalProductId: "wrong-volume",
          barcode: "036602301979",
          name: "Another Generic Retailer Title",
          price: 7_200,
          currency: "usd",
          volume: 700,
          url: "https://example.com/products/wrong-volume",
        },
      ],
    });

    const prices = await db.query.storePrices.findMany({
      where: eq(storePrices.externalSiteId, site.id),
    });
    expect(
      prices.find(
        ({ externalProductId }) => externalProductId === "matching-volume",
      ),
    ).toMatchObject({ bottleId: bottle.id });
    const matched = prices.find(
      ({ externalProductId }) => externalProductId === "matching-volume",
    );
    expect(workerClient.pushUniqueJob).toHaveBeenCalledWith(
      "ResolveStorePriceBottle",
      { priceId: matched!.id, force: true },
    );
    const unresolved = prices.find(
      ({ externalProductId }) => externalProductId === "wrong-volume",
    );
    expect(unresolved).toMatchObject({ bottleId: null });
    expect(workerClient.pushUniqueJob).toHaveBeenCalledWith(
      "ResolveStorePriceBottle",
      { priceId: unresolved!.id },
    );
    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(
          bottleAliases.name,
          normalizeBottleAliasKey("Generic Retailer Title"),
        ),
      }),
    ).toBeUndefined();
  });

  test("uses an identity-preserving alias key as an exact match", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const admin = await fixtures.User({ admin: true });
    const brand = await fixtures.Entity({ name: "Ardbeg" });
    const bottle = await fixtures.Bottle({
      name: "10-year-old",
      brandId: brand.id,
    });
    const rawName = "Ardbeg 10 years old";
    expect(normalizeBottleAliasKey(rawName)).toBe(bottle.fullName);

    await routerClient.prices.createBatch(
      {
        site: site.type,
        prices: [
          {
            name: rawName,
            price: 3_999,
            currency: "usd",
            volume: 750,
            url: "https://example.com/prices/identity-key",
          },
        ],
      },
      { context: { user: admin } },
    );

    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.externalSiteId, site.id),
      }),
    ).toMatchObject({
      bottleId: bottle.id,
      name: bottle.fullName,
    });
    expect(workerClient.pushUniqueJob).not.toHaveBeenCalledWith(
      "ResolveStorePriceBottle",
      expect.anything(),
    );
  });

  test("does not use a lossy display-normalized name as an exact match", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const admin = await fixtures.User({ admin: true });
    const brand = await fixtures.Entity({ name: "Lagavulin" });
    const normalizedAliasBottle = await fixtures.Bottle({
      name: "Distillers Edition",
      brandId: brand.id,
    });
    const rawName = "Lagavulin Distillers Edition 2011 Release";
    expect(normalizeBottleAliasKey(rawName)).not.toBe(
      normalizedAliasBottle.fullName,
    );

    await routerClient.prices.createBatch(
      {
        site: site.type,
        prices: [
          {
            name: rawName,
            price: 3_999,
            currency: "usd",
            volume: 750,
            url: "https://example.com/prices/lossy-name",
          },
        ],
      },
      { context: { user: admin } },
    );

    const price = await db.query.storePrices.findFirst({
      where: eq(storePrices.externalSiteId, site.id),
    });
    expect(price).toMatchObject({
      bottleId: null,
      name: normalizedAliasBottle.fullName,
    });
    expect(workerClient.pushUniqueJob).toHaveBeenCalledWith(
      "ResolveStorePriceBottle",
      { priceId: price!.id },
    );
  });

  test("a concurrent conflict preserves its committed Bottle without incoming finalization", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const admin = await fixtures.User({ admin: true });
    const incomingBottle = await fixtures.Bottle({
      name: "Concurrent Incoming Price Bottle",
    });
    const committedBottle = await fixtures.Bottle({
      name: "Concurrent Committed Price Bottle",
    });
    const listingName = "Concurrent Price Listing® 2024 Release";
    const aliasKey = normalizeBottleAliasKey(listingName);
    const normalizedListingName = normalizeBottle({ name: listingName }).name;
    expect(aliasKey).not.toBe(listingName);
    expect(normalizedListingName).not.toBe(aliasKey);
    await fixtures.BottleAlias({
      name: listingName,
      bottleId: incomingBottle.id,
    });
    const siblingPrice = await fixtures.StorePrice({
      bottleId: null,
      externalSiteId: site.id,
      name: aliasKey,
      volume: 750,
      url: "https://example.com/prices/concurrent-sibling",
    });
    const siblingReview = await fixtures.Review({
      bottleId: null,
      externalSiteId: site.id,
      name: aliasKey,
      url: "https://example.com/reviews/concurrent-sibling",
    });
    const client = new Client(getPostgresConnectionConfig());
    let committed = false;
    let creation:
      | ReturnType<typeof routerClient.prices.createBatch>
      | undefined;

    await client.connect();
    try {
      await client.query("BEGIN");
      const blockerPid = (
        await client.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
      ).rows[0]!.pid;
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
        ["store-price-url:https://example.com/prices/concurrent-result"],
      );
      await client.query(
        `INSERT INTO "store_price"
          ("bottle_id", "external_site_id", "name", "volume", "price", "currency", "url")
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          committedBottle.id,
          site.id,
          normalizedListingName,
          750,
          8_000,
          "usd",
          "https://example.com/prices/concurrent-result",
        ],
      );

      creation = routerClient.prices.createBatch(
        {
          site: site.type,
          prices: [
            {
              name: listingName,
              price: 9_999,
              currency: "usd",
              volume: 750,
              url: "https://example.com/prices/concurrent-result",
            },
          ],
        },
        { context: { user: admin } },
      );
      await waitForSessionBlockedBy(client, blockerPid);
      await client.query("COMMIT");
      committed = true;
      await creation;

      const price = await db.query.storePrices.findFirst({
        where: (storePrices, { and, eq }) =>
          and(
            eq(storePrices.externalSiteId, site.id),
            eq(storePrices.name, normalizedListingName),
          ),
      });
      expect(price).toMatchObject({
        bottleId: committedBottle.id,
        price: 9_999,
        url: "https://example.com/prices/concurrent-result",
      });
      expect(workerClient.pushUniqueJob).toHaveBeenCalledWith(
        "ResolveStorePriceBottle",
        { priceId: price!.id },
      );
      expect(workerClient.pushUniqueJob).not.toHaveBeenCalledWith(
        "IndexBottleSearchVectors",
        { bottleId: incomingBottle.id },
      );
      expect(
        await db.query.storePrices.findFirst({
          where: eq(storePrices.id, siblingPrice.id),
        }),
      ).toMatchObject({ bottleId: null });
      expect(
        await db.query.reviews.findFirst({
          where: eq(reviews.id, siblingReview.id),
        }),
      ).toMatchObject({ bottleId: null });
      expect(
        await db.query.bottleAliases.findFirst({
          where: eq(bottleAliases.name, aliasKey),
        }),
      ).toBeUndefined();
    } finally {
      if (!committed) await client.query("ROLLBACK");
      await client.end();
      await creation?.catch(() => undefined);
    }
  });

  test("locks the Bottle before an existing StorePrice", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const bottle = await fixtures.Bottle({ name: "Lock Order Bottle" });
    const existingPrice = await fixtures.StorePrice({
      bottleId: bottle.id,
      externalSiteId: site.id,
      name: bottle.fullName,
      volume: 750,
    });
    const admin = await fixtures.User({ admin: true });
    const client = new Client(getPostgresConnectionConfig());
    let committed = false;
    let creation:
      | ReturnType<typeof routerClient.prices.createBatch>
      | undefined;

    await client.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL lock_timeout = '1s'");
      const blockerPid = (
        await client.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
      ).rows[0]!.pid;
      await client.query(
        `UPDATE "bottle" SET "updated_at" = "updated_at" WHERE "id" = $1`,
        [bottle.id],
      );

      creation = routerClient.prices.createBatch(
        {
          site: site.type,
          prices: [
            {
              name: bottle.fullName,
              price: 12_345,
              currency: "usd",
              volume: 750,
              url: existingPrice.url,
            },
          ],
        },
        { context: { user: admin } },
      );
      await waitForSessionBlockedBy(client, blockerPid);

      await client.query(
        `UPDATE "store_price" SET "price" = "price" WHERE "id" = $1`,
        [existingPrice.id],
      );
      await client.query("COMMIT");
      committed = true;
      await creation;
    } finally {
      if (!committed) await client.query("ROLLBACK");
      await client.end();
      await creation?.catch(() => undefined);
    }

    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.id, existingPrice.id),
      }),
    ).toMatchObject({
      bottleId: bottle.id,
      price: 12_345,
    });
  });

  test("an unresolved retry preserves a durable Bottle and queues resolution", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const admin = await fixtures.User({ admin: true });
    const bottle = await fixtures.Bottle({
      name: "Durable Price Bottle",
    });
    const listingName = "Durable Unresolved Price";
    const existing = await fixtures.StorePrice({
      externalSiteId: site.id,
      bottleId: bottle.id,
      name: listingName,
      volume: 750,
    });

    await routerClient.prices.createBatch(
      {
        site: site.type,
        prices: [
          {
            name: listingName,
            price: 6_999,
            currency: "usd",
            volume: 750,
            url: existing.url,
          },
        ],
      },
      { context: { user: admin } },
    );

    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.id, existing.id),
      }),
    ).toMatchObject({
      bottleId: bottle.id,
      price: 6_999,
    });
    expect(workerClient.pushUniqueJob).toHaveBeenCalledWith(
      "ResolveStorePriceBottle",
      { priceId: existing.id },
    );
  });

  test("rolls back StorePrice and history writes for a retired alias Bottle", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const admin = await fixtures.User({ admin: true });
    const bottle = await fixtures.Bottle({
      name: "Retired Price Bottle",
    });
    await db.insert(bottleTombstones).values({
      bottleId: bottle.id,
      newBottleId: null,
    });

    await expect(
      routerClient.prices.createBatch(
        {
          site: site.type,
          prices: [
            {
              name: bottle.fullName,
              price: 10_999,
              currency: "usd",
              volume: 750,
              url: "https://example.com/prices/retired",
            },
          ],
        },
        { context: { user: admin } },
      ),
    ).rejects.toThrow(`Bottle ${bottle.id} is retired`);

    expect(
      await db.query.storePrices.findMany({
        where: eq(storePrices.externalSiteId, site.id),
      }),
    ).toHaveLength(0);
    expect(await db.select().from(storePriceHistories)).toHaveLength(0);
  });

  test("finalizes a matched StorePrice image onto an empty Bottle image", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const admin = await fixtures.User({ admin: true });
    const bottle = await fixtures.Bottle({
      name: "Image Price Bottle",
      imageUrl: null,
    });
    const imageUrl = "https://example.com/images/retailer-bottle.jpg";
    const existingPrice = await fixtures.StorePrice({
      bottleId: bottle.id,
      externalSiteId: site.id,
      name: bottle.fullName,
      volume: 750,
      imageUrl,
    });

    await routerClient.prices.createBatch(
      {
        site: site.type,
        prices: [
          {
            name: bottle.fullName,
            price: 9_999,
            currency: "usd",
            volume: 750,
            url: existingPrice.url,
          },
        ],
      },
      { context: { user: admin } },
    );

    expect(
      await db.query.bottles.findFirst({
        where: (bottles, { eq }) => eq(bottles.id, bottle.id),
      }),
    ).toMatchObject({ imageUrl });
    expect(workerClient.pushJob).not.toHaveBeenCalledWith(
      "CapturePriceImage",
      expect.anything(),
    );
  });
});
