import { db } from "@peated/server/db";
import {
  externalSiteRuns,
  externalSiteScrapeTargets,
  scrapeOrigins,
  scrapeTargets,
  storePrices,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { expect, test } from "vitest";

test("health list requires an administrator", async () => {
  const error = await waitError(() =>
    routerClient.externalSites.healthList({}),
  );
  expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
});

test("health list reports source inventory, runtime, and latest execution", async ({
  fixtures,
}) => {
  const admin = await fixtures.User({ admin: true });
  const site = await fixtures.ExternalSite({
    type: "decadentdrinks",
    lastRunAt: new Date("2026-08-12T10:00:00.000Z"),
  });
  const visiblePrice = await fixtures.StorePrice({ externalSiteId: site.id });
  await db
    .update(storePrices)
    .set({ hidden: false })
    .where(eq(storePrices.id, visiblePrice.id));
  await fixtures.StorePrice({
    externalSiteId: site.id,
    bottleId: null,
    hidden: false,
  });
  await db.insert(scrapeTargets).values({
    key: "decadentdrinks",
    enabled: true,
    minimumSpacingMs: 2_000,
    requestsPerWindow: 300,
    windowMs: 3_600_000,
    timeoutMs: 30_000,
    maxResponseBytes: 10_485_760,
    maxRetries: 2,
  });
  await db.insert(scrapeOrigins).values({
    origin: "https://decadent-drinks.com",
    targetKey: "decadentdrinks",
    robotsMode: "enforce",
    robotsState: { status: "missing" },
    robotsFetchedAt: new Date("2026-08-12T11:00:00.000Z"),
    robotsExpiresAt: new Date("2026-08-13T11:00:00.000Z"),
  });
  await db.insert(externalSiteScrapeTargets).values({
    externalSiteId: site.id,
    targetKey: "decadentdrinks",
  });
  const completedAt = new Date("2026-08-12T12:00:00.000Z");
  const [run] = await db
    .insert(externalSiteRuns)
    .values({
      externalSiteId: site.id,
      status: "failed",
      trigger: "manual",
      requestedById: admin.id,
      attemptCount: 2,
      requestLimit: 50,
      sliceRequestCount: 4,
      requestCount: 12,
      retryCount: 2,
      rateLimitCount: 1,
      emittedItemCount: 8,
      itemCount: 8,
      error: "Unexpected scraper failure. See Sentry for this run.",
      startedAt: new Date("2026-08-12T11:59:00.000Z"),
      completedAt,
    })
    .returning();

  const result = await routerClient.externalSites.healthList(
    {},
    { context: { user: admin } },
  );

  expect(result.results).toHaveLength(1);
  expect(result.results[0]).toMatchObject({
    type: "decadentdrinks",
    reviews: { total: 0, matched: 0, unmatched: 0 },
    priceListings: { total: 2, matched: 1, unmatched: 1 },
    lastRunAt: null,
    latestRun: {
      id: run?.id,
      status: "failed",
      trigger: "manual",
      attemptCount: 2,
      requestLimit: 50,
      sliceRequestCount: 4,
      requestCount: 12,
      retryCount: 2,
      rateLimitCount: 1,
      emittedItemCount: 8,
    },
    lastSucceededAt: null,
    runtime: {
      registered: true,
      targetKeys: ["decadentdrinks"],
      targets: [
        {
          key: "decadentdrinks",
          enabled: true,
          origins: [
            {
              origin: "https://decadent-drinks.com",
              robotsMode: "enforce",
              robotsStatus: "missing",
            },
          ],
        },
      ],
    },
    reviewPolicy: null,
  });
});

test("health list keeps batched source data isolated", async ({ fixtures }) => {
  const admin = await fixtures.User({ admin: true });
  const firstSite = await fixtures.ExternalSite({ type: "berrybrosrudd" });
  const secondSite = await fixtures.ExternalSite({ type: "totalwine" });
  await fixtures.StorePrice({
    externalSiteId: firstSite.id,
    hidden: false,
  });
  await fixtures.StorePrice({
    externalSiteId: secondSite.id,
    bottleId: null,
    hidden: false,
  });
  await db.insert(externalSiteRuns).values([
    {
      externalSiteId: firstSite.id,
      status: "succeeded",
      trigger: "scheduled",
      completedAt: new Date("2026-08-12T12:00:00.000Z"),
    },
    {
      externalSiteId: secondSite.id,
      status: "failed",
      trigger: "scheduled",
      completedAt: new Date("2026-08-12T13:00:00.000Z"),
    },
  ]);

  const result = await routerClient.externalSites.healthList(
    {},
    { context: { user: admin } },
  );
  const first = result.results.find((site) => site.type === firstSite.type);
  const second = result.results.find((site) => site.type === secondSite.type);

  expect(first).toMatchObject({
    priceListings: { total: 1, matched: 1, unmatched: 0 },
    latestRun: { status: "succeeded" },
    lastSucceededAt: "2026-08-12T12:00:00.000Z",
  });
  expect(second).toMatchObject({
    priceListings: { total: 1, matched: 0, unmatched: 1 },
    latestRun: { status: "failed" },
    lastSucceededAt: null,
  });
});

test("health details show review inventory and blocked review policy", async ({
  fixtures,
}) => {
  const admin = await fixtures.User({ admin: true });
  const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });
  await fixtures.Review({
    externalSiteId: site.id,
    hidden: false,
  });
  await fixtures.Review({
    externalSiteId: site.id,
    bottleId: null,
    hidden: false,
  });
  await db.insert(scrapeTargets).values({
    key: "whiskyadvocate",
    enabled: false,
    minimumSpacingMs: 2_000,
    requestsPerWindow: 300,
    windowMs: 3_600_000,
    timeoutMs: 30_000,
    maxResponseBytes: 10_485_760,
    maxRetries: 2,
  });
  await db.insert(scrapeOrigins).values({
    origin: "https://whiskyadvocate.com",
    targetKey: "whiskyadvocate",
    robotsMode: "enforce",
  });
  await db.insert(externalSiteScrapeTargets).values({
    externalSiteId: site.id,
    targetKey: "whiskyadvocate",
  });

  const result = await routerClient.externalSites.healthDetails(
    { site: site.type },
    { context: { user: admin } },
  );

  expect(result).toMatchObject({
    reviews: { total: 2, matched: 1, unmatched: 1 },
    priceListings: { total: 0, matched: 0, unmatched: 0 },
    runtime: {
      registered: true,
      targetKeys: ["whiskyadvocate"],
      targets: [
        {
          key: "whiskyadvocate",
          enabled: false,
          origins: [
            {
              robotsMode: "enforce",
              robotsStatus: "unknown",
            },
          ],
        },
      ],
    },
    reviewPolicy: {
      publicationMode: "disabled",
      allowFetching: false,
    },
  });
});

test("run history exposes request and deferral telemetry", async ({
  fixtures,
}) => {
  const admin = await fixtures.User({ admin: true });
  const site = await fixtures.ExternalSite({ type: "decadentdrinks" });
  const nextAttemptAt = new Date("2026-08-13T10:00:00.000Z");
  await db.insert(externalSiteRuns).values({
    externalSiteId: site.id,
    status: "queued",
    trigger: "scheduled",
    attemptCount: 3,
    requestLimit: 40,
    sliceRequestCount: 0,
    requestCount: 20,
    retryCount: 3,
    rateLimitCount: 2,
    emittedItemCount: 15,
    nextAttemptAt,
  });

  const result = await routerClient.externalSites.runs(
    { site: site.type },
    { context: { user: admin } },
  );

  expect(result.results[0]).toMatchObject({
    status: "queued",
    attemptCount: 3,
    requestLimit: 40,
    sliceRequestCount: 0,
    requestCount: 20,
    retryCount: 3,
    rateLimitCount: 2,
    emittedItemCount: 15,
    nextAttemptAt: nextAttemptAt.toISOString(),
  });
});

test("run history is administrator-only", async ({ fixtures }) => {
  const site = await fixtures.ExternalSite({ type: "decadentdrinks" });
  const error = await waitError(() =>
    routerClient.externalSites.runs({ site: site.type }),
  );
  expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
});
