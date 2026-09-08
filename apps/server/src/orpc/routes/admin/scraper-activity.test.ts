import { db } from "@peated/server/db";
import {
  externalSiteRuns,
  incomingBottleDecisionLogs,
  scrapeSourceRuns,
  scrapeSources,
} from "@peated/server/db/schema";
import { getPeatedSystemActor } from "@peated/server/lib/actors";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";

function utcStartOfToday() {
  const value = new Date();
  value.setUTCHours(0, 0, 0, 0);
  return value;
}

describe("GET /admin/scrapers/activity", () => {
  test("reports source activity and Bottle resolution for the last 30 days", async ({
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });
    const reviewSite = await fixtures.ExternalSite({
      type: "activity-reviews",
      name: "Activity Reviews",
    });
    const priceSite = await fixtures.ExternalSite({
      type: "activity-prices",
      name: "Activity Prices",
    });
    const bottle = await fixtures.Bottle();
    const systemActor = await getPeatedSystemActor();
    const today = utcStartOfToday();
    const startedAt = new Date(today.getTime() + 60 * 60_000);
    const completedAt = new Date(today.getTime() + 2 * 60 * 60_000);
    const olderThanWindow = new Date(today);
    olderThanWindow.setUTCDate(olderThanWindow.getUTCDate() - 30);

    await db.insert(externalSiteRuns).values([
      {
        externalSiteId: reviewSite.id,
        status: "failed",
        trigger: "scheduled",
        purpose: "collect",
        recordType: "review",
        requestCount: 12,
        requestErrorCount: 2,
        retryCount: 1,
        rateLimitCount: 1,
        emittedItemCount: 8,
        newItemCount: 3,
        existingItemCount: 5,
        error: "The source returned error 503.",
        startedAt,
        completedAt,
        createdAt: startedAt,
      },
      {
        externalSiteId: priceSite.id,
        status: "succeeded",
        trigger: "scheduled",
        purpose: "collect",
        recordType: null,
        requestCount: 4,
        requestErrorCount: null,
        emittedItemCount: 6,
        createdAt: startedAt,
        startedAt,
        completedAt,
      },
      {
        externalSiteId: priceSite.id,
        status: "succeeded",
        trigger: "scheduled",
        purpose: "collect",
        recordType: "price",
        requestCount: 5,
        requestErrorCount: 0,
        emittedItemCount: 5,
        newItemCount: 2,
        existingItemCount: 3,
        createdAt: startedAt,
        startedAt,
        completedAt,
      },
      {
        externalSiteId: reviewSite.id,
        status: "succeeded",
        trigger: "scheduled",
        purpose: "collect",
        recordType: "bottle",
        requestCount: 0,
        requestErrorCount: 0,
        emittedItemCount: 2,
        newItemCount: 1,
        existingItemCount: 1,
        createdAt: startedAt,
        startedAt,
        completedAt,
      },
      {
        externalSiteId: reviewSite.id,
        status: "succeeded",
        trigger: "scheduled",
        purpose: "collect",
        recordType: "catalog",
        requestCount: 2,
        requestErrorCount: 0,
        emittedItemCount: 3,
        newItemCount: 2,
        existingItemCount: 1,
        createdAt: startedAt,
        startedAt,
        completedAt,
      },
      {
        externalSiteId: reviewSite.id,
        status: "succeeded",
        trigger: "manual",
        purpose: "preview",
        recordType: "review",
        requestCount: 20,
        requestErrorCount: 0,
        emittedItemCount: 20,
        createdAt: startedAt,
        startedAt,
        completedAt,
      },
    ]);
    const [suggestionRun] = await db
      .insert(externalSiteRuns)
      .values({
        externalSiteId: reviewSite.id,
        status: "succeeded",
        trigger: "manual",
        purpose: "collect",
        requestCount: 30,
        requestErrorCount: 0,
        emittedItemCount: 30,
        createdAt: startedAt,
        startedAt,
        completedAt,
      })
      .returning();
    const [source] = await db
      .insert(scrapeSources)
      .values({
        externalSiteId: reviewSite.id,
        kind: "review",
        listUrl: "https://activity-reviews.example/",
      })
      .returning();
    if (!suggestionRun || !source) throw new Error("Failed to create run.");
    await db.insert(scrapeSourceRuns).values({
      externalSiteRunId: suggestionRun.id,
      scrapeSourceId: source.id,
      revisionId: null,
      purpose: "suggest",
    });

    const createdReview = await fixtures.ExternalReview({
      externalSiteId: reviewSite.id,
      bottleId: bottle.id,
      createdAt: startedAt,
    });
    const matchedPrice = await fixtures.StorePrice({
      externalSiteId: priceSite.id,
      bottleId: bottle.id,
      createdAt: startedAt,
    });
    await fixtures.ExternalReview({
      externalSiteId: reviewSite.id,
      bottleId: bottle.id,
      createdAt: startedAt,
    });
    await fixtures.StorePrice({
      externalSiteId: priceSite.id,
      bottleId: null,
      createdAt: startedAt,
    });
    await fixtures.ExternalReview({
      externalSiteId: reviewSite.id,
      bottleId: null,
      hidden: true,
      createdAt: startedAt,
    });
    await fixtures.StorePrice({
      externalSiteId: priceSite.id,
      bottleId: null,
      createdAt: olderThanWindow,
    });

    await db.insert(incomingBottleDecisionLogs).values([
      {
        sourceKind: "review",
        sourceId: createdReview.id,
        externalSiteId: reviewSite.id,
        name: createdReview.name,
        decision: "create_bottle",
        actorId: systemActor.id,
        bottleId: bottle.id,
        createdBottle: true,
        createdAt: startedAt,
      },
      {
        sourceKind: "store_price",
        sourceId: matchedPrice.id,
        externalSiteId: priceSite.id,
        name: matchedPrice.name,
        decision: "match_existing",
        actorId: systemActor.id,
        bottleId: bottle.id,
        createdAt: startedAt,
      },
    ]);

    const result = await routerClient.admin.scraperActivity(undefined, {
      context: { user: admin },
    });

    expect(result.totals).toEqual({
      requests: 23,
      requestErrors: 2,
      requestErrorsComplete: false,
      runs: 5,
      failedRuns: 1,
    });
    expect(result.days[0]).toEqual({
      date: today.toISOString().slice(0, 10),
      ...result.totals,
      reviews: 8,
      prices: 5,
      catalogListings: 5,
    });
    expect(result.saved).toEqual({
      reviews: { total: 8, new: 3, existing: 5 },
      prices: { total: 5, new: 2, existing: 3 },
      catalogListings: { total: 5, new: 3, existing: 2 },
    });
    expect(result.bottleResolution).toEqual({
      unknown: 1,
      created: 1,
      matched: 2,
    });
    expect(result.recentFailures).toEqual([
      {
        runId: expect.any(Number),
        site: { key: reviewSite.type, name: reviewSite.name },
        error: "The source returned error 503.",
        completedAt: completedAt.toISOString(),
      },
    ]);
  });

  test("requires an administrator", async ({ defaults }) => {
    const anonymousError = await waitError(
      routerClient.admin.scraperActivity(),
    );
    const memberError = await waitError(
      routerClient.admin.scraperActivity(undefined, {
        context: { user: defaults.user },
      }),
    );

    expect(anonymousError).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
    expect(memberError).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });
});
