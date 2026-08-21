import {
  EXTERNAL_SITE_DEFINITIONS,
  EXTERNAL_SITE_TYPE_LIST,
  isExternalReviewSiteType,
} from "@peated/server/constants";
import { db } from "@peated/server/db";
import {
  externalReviewSourcePolicies,
  externalSiteRuns,
  externalSites,
  reviewArticles,
  reviews,
  storePrices,
} from "@peated/server/db/schema";
import { ReviewArticleIngestionSchema } from "@peated/server/externalReviews/observation";
import { syncExternalSites } from "@peated/server/lib/externalSites";
import { loadFixture } from "@peated/server/lib/test/fixtures";
import { eq } from "drizzle-orm";
import { vi } from "vitest";
import type { ScraperHttpClock } from "./http";
import { createScraperLifecycle } from "./lifecycle";
import { scraperRegistry } from "./registry";
import { executeScraperRun } from "./runs";
import { externalReviewSink } from "./sinks/externalReviews";
import { syncScraperDefinitions } from "./syncDefinitions";

const migratedSources = [
  "astorwines",
  "berrybrosrudd",
  "bruichladdich",
  "bourbonculture",
  "cadenheads",
  "compassbox",
  "decadentdrinks",
  "douglaslaing",
  "dramface",
  "dramfool",
  "edradour",
  "finedrams",
  "fredminnick",
  "glenallachie",
  "gordonmacphail",
  "healthyspirits",
  "kilchoman",
  "masterofmalt",
  "missionliquor",
  "ncnean",
  "northstarspirits",
  "reservebar",
  "smws",
  "smwsa",
  "singlecasknation",
  "thompsonbros",
  "totalwine",
  "whiskeyreviewer",
  "whiskyadvocate",
  "whiskyfun",
  "whiskynotes",
  "whiskyworld",
  "woodencork",
  "wordsofwhisky",
];

type RuntimeTestClock = ScraperHttpClock & { advanceTo(value: Date): void };

function runtimeClock(): RuntimeTestClock {
  let now = new Date("2026-08-18T12:00:00Z");
  return {
    now: () => now,
    sleep: async (milliseconds) => {
      now = new Date(now.getTime() + milliseconds);
    },
    random: () => 0,
    advanceTo: (value) => {
      now = value;
    },
  };
}

test("registers every scraper source with explicit target ownership", () => {
  expect([...scraperRegistry.sources.keys()].sort()).toEqual(
    migratedSources.sort(),
  );
  for (const source of scraperRegistry.sources.values()) {
    expect(source.targetKeys).toEqual([source.externalSiteType]);
    expect(scraperRegistry.targets.get(source.targetKeys[0])).toBeDefined();
  }
  expect(scraperRegistry.targets.get("astorwines")?.enabled).toBe(true);
  expect(EXTERNAL_SITE_DEFINITIONS.astorwines.runEvery).toBeNull();
  expect(EXTERNAL_SITE_DEFINITIONS.dramfool.runEvery).toBeNull();
  expect(scraperRegistry.targets.get("dramfool")?.enabled).toBe(true);
  expect(scraperRegistry.targets.get("totalwine")?.enabled).toBe(false);
  expect(EXTERNAL_SITE_DEFINITIONS.bourbonculture.runEvery).toBe(1440);
  expect(scraperRegistry.targets.get("bourbonculture")).toMatchObject({
    minimumSpacingMs: 5_000,
    requestsPerWindow: 10,
    windowMs: 3_600_000,
  });
  expect(scraperRegistry.sources.get("bourbonculture")?.requestLimit).toBe(7);
  expect(EXTERNAL_SITE_DEFINITIONS.dramface.runEvery).toBe(1440);
  expect(scraperRegistry.targets.get("dramface")).toMatchObject({
    minimumSpacingMs: 2_500,
    requestsPerWindow: 25,
    windowMs: 3_600_000,
  });
  expect(scraperRegistry.sources.get("dramface")?.requestLimit).toBe(30);
  expect(EXTERNAL_SITE_DEFINITIONS.fredminnick.runEvery).toBe(1440);
  expect(scraperRegistry.targets.get("fredminnick")).toMatchObject({
    minimumSpacingMs: 30_000,
    requestsPerWindow: 10,
    windowMs: 3_600_000,
  });
  expect(scraperRegistry.sources.get("fredminnick")?.requestLimit).toBe(9);
  expect(EXTERNAL_SITE_DEFINITIONS.whiskeyreviewer.runEvery).toBe(1440);
  expect(scraperRegistry.targets.get("whiskeyreviewer")).toMatchObject({
    minimumSpacingMs: 5_000,
    requestsPerWindow: 10,
    windowMs: 3_600_000,
  });
  expect(scraperRegistry.sources.get("whiskeyreviewer")?.requestLimit).toBe(6);
  expect(EXTERNAL_SITE_DEFINITIONS.whiskyadvocate.runEvery).toBeNull();
  expect(scraperRegistry.targets.get("whiskyadvocate")).toMatchObject({
    minimumSpacingMs: 2_500,
    requestsPerWindow: 20,
    windowMs: 3_600_000,
  });
  expect(scraperRegistry.sources.get("whiskyadvocate")?.requestLimit).toBe(30);
  expect(EXTERNAL_SITE_DEFINITIONS.whiskynotes.runEvery).toBeNull();
  expect(scraperRegistry.targets.get("whiskynotes")).toMatchObject({
    minimumSpacingMs: 2_500,
    requestsPerWindow: 30,
    windowMs: 3_600_000,
  });
  expect(scraperRegistry.sources.get("whiskynotes")?.requestLimit).toBe(30);
  expect(EXTERNAL_SITE_DEFINITIONS.whiskyfun.runEvery).toBe(1440);
  expect(scraperRegistry.targets.get("whiskyfun")).toMatchObject({
    minimumSpacingMs: 2_500,
    requestsPerWindow: 25,
    windowMs: 3_600_000,
  });
  expect(scraperRegistry.sources.get("whiskyfun")?.requestLimit).toBe(30);
  expect(EXTERNAL_SITE_DEFINITIONS.wordsofwhisky.runEvery).toBe(1440);
  expect(scraperRegistry.targets.get("wordsofwhisky")).toMatchObject({
    minimumSpacingMs: 2_500,
    requestsPerWindow: 25,
    windowMs: 3_600_000,
  });
  expect(scraperRegistry.sources.get("wordsofwhisky")?.requestLimit).toBe(25);
  for (const type of EXTERNAL_SITE_TYPE_LIST.filter(isExternalReviewSiteType)) {
    const source = scraperRegistry.sources.get(type);
    expect(source, `${type} is not registered`).toBeDefined();
    expect(source?.observationSchema).toBe(ReviewArticleIngestionSchema);
    expect(source?.sink).toBe(externalReviewSink);
  }
});

test("runs Bruichladdich through the production runtime with fixture parity", async () => {
  await syncExternalSites();
  await syncScraperDefinitions(scraperRegistry);
  const [site] = await db
    .select()
    .from(externalSites)
    .where(eq(externalSites.type, "bruichladdich"));
  if (!site) throw new Error("Expected synchronized site.");
  const [run] = await db
    .insert(externalSiteRuns)
    .values({
      externalSiteId: site.id,
      trigger: "manual",
      requestLimit: 100,
    })
    .returning();
  if (!run) throw new Error("Expected run.");
  const fixture = await loadFixture("bruichladdich", "bottle-list.json");
  const fetchImpl = vi.fn<typeof fetch>(async (input) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.pathname === "/robots.txt") {
      return new Response(null, { status: 404 });
    }
    if (url.searchParams.get("page") === "1") return new Response(fixture);
    return new Response(JSON.stringify({ products: [] }));
  });

  await expect(
    executeScraperRun(
      { runId: run.id },
      {
        registry: scraperRegistry,
        fetchImpl,
        clock: runtimeClock(),
        executionToken: "owner",
      },
    ),
  ).resolves.toEqual({ status: "completed" });

  expect(
    await db
      .select()
      .from(storePrices)
      .where(eq(storePrices.externalSiteId, site.id)),
  ).toHaveLength(4);
  const [storedRun] = await db
    .select()
    .from(externalSiteRuns)
    .where(eq(externalSiteRuns.id, run.id));
  expect(storedRun).toMatchObject({
    status: "succeeded",
    requestCount: 3,
    emittedItemCount: 4,
    itemCount: 4,
    cursor: { sequence: 1, page: 1 },
  });
});

test("runs the bounded WhiskyNotes adapter through the production runtime", async ({
  fixtures,
}) => {
  await syncExternalSites();
  await syncScraperDefinitions(scraperRegistry);
  const [site] = await db
    .select()
    .from(externalSites)
    .where(eq(externalSites.type, "whiskynotes"));
  if (!site) throw new Error("Expected synchronized WhiskyNotes site.");
  await db
    .update(externalReviewSourcePolicies)
    .set({
      publicationMode: "review_only",
      allowLlmProcessing: false,
      allowScoreDisplay: true,
      allowSummaryDisplay: false,
    })
    .where(eq(externalReviewSourcePolicies.externalSiteId, site.id));
  await fixtures.Bottle({ name: "Kanekou Okinawa Whisky" });
  await fixtures.Bottle({ name: "Ben Nevis 30 yo 1996" });
  await fixtures.Bottle({ name: "Bowmore 20 yo 2005" });
  const [run] = await db
    .insert(externalSiteRuns)
    .values({
      externalSiteId: site.id,
      trigger: "manual",
      requestLimit: 30,
    })
    .returning();
  if (!run) throw new Error("Expected run.");
  const archive = (await loadFixture("whiskynotes", "archive.html")).replace(
    /<link rel="next"[^>]+>/,
    "",
  );
  const singleReview = await loadFixture("whiskynotes", "single-review.html");
  const multiReview = await loadFixture("whiskynotes", "multi-review.html");
  const fetchImpl = vi.fn<typeof fetch>(async (input) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.pathname === "/robots.txt") {
      return new Response("User-agent: *\nDisallow:");
    }
    if (url.pathname === "/") return new Response(archive);
    if (url.pathname.includes("kanekou-okinawa-whisky")) {
      return new Response(singleReview);
    }
    if (url.pathname.includes("bowmore-2005-ben-nevis")) {
      return new Response(multiReview);
    }
    return new Response(null, { status: 404 });
  });

  const clock = runtimeClock();
  let result = null;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    result = await executeScraperRun(
      { runId: run.id },
      {
        registry: scraperRegistry,
        fetchImpl,
        clock,
        executionToken: "whiskynotes-owner",
      },
    );
    if (result.status === "completed") break;
    if (result.status === "deferred" || result.status === "not_ready") {
      clock.advanceTo(result.nextAttemptAt);
      continue;
    }
    throw new Error(`Unexpected scraper result: ${result.status}`);
  }
  expect(result).toEqual({ status: "completed" });

  expect(
    await db
      .select()
      .from(reviewArticles)
      .where(eq(reviewArticles.externalSiteId, site.id)),
  ).toHaveLength(2);
  expect(await db.select().from(reviews)).toHaveLength(4);
  expect(
    await db
      .select()
      .from(externalSiteRuns)
      .where(eq(externalSiteRuns.id, run.id)),
  ).toMatchObject([
    {
      status: "succeeded",
      requestCount: 4,
      emittedItemCount: 4,
      itemCount: 4,
    },
  ]);
});

test("dispatches migrated sources to the isolated scraper job", async ({
  fixtures,
}) => {
  const requestedBy = await fixtures.User({ admin: true });
  const site = await fixtures.ExternalSite({ type: "bruichladdich" });
  const enqueue = vi.fn(async () => undefined);

  const run = await createScraperLifecycle({
    registry: scraperRegistry,
    enqueue,
  }).queueManualExternalSiteRun({ site, requestedById: requestedBy.id });

  expect(run.requestLimit).toBe(100);
  expect(enqueue).toHaveBeenCalledWith(
    "RunScraper",
    { runId: run.id },
    {
      jobId: `external-site-run-${run.id}`,
      removeOnComplete: true,
      removeOnFail: true,
    },
  );
});
