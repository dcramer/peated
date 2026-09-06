import { db } from "@peated/server/db";
import {
  externalSiteRuns,
  scrapeSourceRuns,
  scrapeSources,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";

function utcStartOfToday() {
  const value = new Date();
  value.setUTCHours(0, 0, 0, 0);
  return value;
}

describe("GET /admin/scrapers/activity", () => {
  test("reports collection activity and leaves older counts untracked", async ({
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
    const today = utcStartOfToday();
    const startedAt = new Date(today.getTime() + 60 * 60_000);
    const completedAt = new Date(today.getTime() + 2 * 60 * 60_000);

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

    const result = await routerClient.admin.scraperActivity(undefined, {
      context: { user: admin },
    });

    expect(result.totals).toEqual({
      requests: 16,
      requestErrors: 2,
      requestErrorsComplete: false,
      runs: 2,
      failedRuns: 1,
      records: 14,
      newRecords: 3,
      existingRecords: 5,
      untrackedRecords: 6,
    });
    expect(result.days[0]).toEqual({
      date: today.toISOString().slice(0, 10),
      ...result.totals,
    });
    expect(result.recordTypes).toEqual([
      {
        type: "review",
        records: 8,
        newRecords: 3,
        existingRecords: 5,
        untrackedRecords: 0,
      },
      {
        type: "price",
        records: 0,
        newRecords: 0,
        existingRecords: 0,
        untrackedRecords: 0,
      },
      {
        type: "catalog",
        records: 0,
        newRecords: 0,
        existingRecords: 0,
        untrackedRecords: 0,
      },
      {
        type: "bottle",
        records: 0,
        newRecords: 0,
        existingRecords: 0,
        untrackedRecords: 0,
      },
      {
        type: "untracked",
        records: 6,
        newRecords: 0,
        existingRecords: 0,
        untrackedRecords: 6,
      },
    ]);
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
