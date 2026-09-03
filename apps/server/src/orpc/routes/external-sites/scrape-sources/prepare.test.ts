import { db } from "@peated/server/db";
import {
  externalReviewArticles,
  externalReviewBodies,
  externalReviewPublications,
  externalReviews,
  externalSiteRuns,
  externalSites,
  scrapeSourceRuns,
  scrapeSources,
  scrapeTargets,
  type User,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { createScrapeSourceSuggestionRun } from "@peated/server/scraper/configured/runs";
import { resolveScrapeSourceRunRegistry } from "@peated/server/scraper/configured/runtime";
import {
  activateScrapeSourceRevision,
  createScrapeSourceRevision,
  pauseScrapeSource,
  recordScrapeSourcePreview,
  ScrapeSourceValidationError,
} from "@peated/server/scraper/configured/service";
import { createScraperRegistry } from "@peated/server/scraper/definitions";
import { createScraperLifecycle } from "@peated/server/scraper/lifecycle";
import { scraperRegistry } from "@peated/server/scraper/registry";
import { executeScraperRun } from "@peated/server/scraper/runs";
import { syncScraperDefinitions } from "@peated/server/scraper/syncDefinitions";
import { eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { beforeEach, describe, vi } from "vitest";

let admin: User;
beforeEach(async ({ fixtures }) => {
  admin = await fixtures.User({ admin: true });
});

function prepare(input: { apply?: boolean } = {}) {
  return routerClient.externalSites.scrapeSources.prepare(
    { site: "bourbonculture", ...input },
    {
      context: { user: admin },
    },
  );
}

function prepareWhiskyStudy(input: { apply?: boolean } = {}) {
  return routerClient.externalSites.scrapeSources.prepare(
    { site: "whiskystudy", ...input },
    {
      context: { user: admin },
    },
  );
}

const canonicalUrl =
  "https://thebourbonculture.com/whiskey-reviews/example-review/";
const registry = createScraperRegistry({
  targets: [scraperRegistry.targets.get("bourbonculture")!],
  sources: [
    {
      ...scraperRegistry.sources.get("bourbonculture")!,
      externalSiteKey: "bourbonculture",
    },
  ],
});

const whiskyStudyCanonicalUrl =
  "https://thewhiskystudy.com/reviews-3/example-scotch-review";
const whiskyStudyRegistry = createScraperRegistry({
  targets: [scraperRegistry.targets.get("whiskystudy")!],
  sources: [
    {
      ...scraperRegistry.sources.get("whiskystudy")!,
      externalSiteKey: "whiskystudy",
    },
  ],
});

async function setupMigration(bottleId: number | null = null) {
  const [site] = await db
    .insert(externalSites)
    .values({
      type: "bourbonculture",
      name: "Bourbon Culture",
      runEvery: null,
    })
    .returning();
  await syncScraperDefinitions(registry);
  const [article] = await db
    .insert(externalReviewArticles)
    .values({
      externalSiteId: site.id,
      canonicalUrl,
      title: "Example Review",
      publishedAt: new Date("2026-08-01"),
    })
    .returning();
  const [review] = await db
    .insert(externalReviews)
    .values({
      articleId: article.id,
      sourceKey: `bourbonculture:${createHash("sha256").update(canonicalUrl).digest("hex")}`,
      name: "Example",
      bottleId,
      hidden: true,
      reviewerName: "Example Writer",
      nativeScoreValue: 8,
      nativeScoreScale: 10,
      nativeScoreDisplay: "8/10",
      clip: "An existing clip.",
      tags: ["vanilla"],
    })
    .returning();
  await db.insert(externalReviewBodies).values({
    externalReviewId: review.id,
    body: "Synthetic old review body.",
    fetchedAt: new Date(),
  });
  await db.insert(externalReviewPublications).values({
    externalSiteId: site.id,
    approvedAt: new Date(),
  });
  await db.insert(externalSiteRuns).values({
    externalSiteId: site.id,
    status: "succeeded",
    trigger: "scheduled",
    completedAt: new Date(),
  });
  return { site, article, review };
}

async function setupWhiskyStudyMigration(bottleId: number | null = null) {
  const [site] = await db
    .insert(externalSites)
    .values({
      type: "whiskystudy",
      name: "The Whisky Study",
      runEvery: null,
    })
    .returning();
  await syncScraperDefinitions(whiskyStudyRegistry);
  const [article] = await db
    .insert(externalReviewArticles)
    .values({
      externalSiteId: site.id,
      canonicalUrl: whiskyStudyCanonicalUrl,
      title: "Example Scotch 18 Year Shelf Review",
      publishedAt: new Date("2026-07-04"),
    })
    .returning();
  const [review] = await db
    .insert(externalReviews)
    .values({
      articleId: article.id,
      sourceKey: `whiskystudy:${createHash("sha256").update(whiskyStudyCanonicalUrl).digest("hex")}`,
      name: "Example Scotch 18 Year",
      bottleId,
      hidden: true,
      reviewerName: "Chris Ellis",
      nativeScoreValue: 92,
      nativeScoreScale: 100,
      nativeScoreDisplay: "92/100",
      clip: "An existing clip.",
      tags: ["orchard fruit"],
    })
    .returning();
  await db.insert(externalReviewBodies).values({
    externalReviewId: review.id,
    body: "Synthetic old review body.",
    fetchedAt: new Date(),
  });
  await db.insert(externalReviewPublications).values({
    externalSiteId: site.id,
    approvedAt: null,
  });
  await db.insert(externalSiteRuns).values({
    externalSiteId: site.id,
    status: "succeeded",
    trigger: "scheduled",
    completedAt: new Date(),
  });
  return { site, article, review };
}

describe("POST /admin/scrape-sources/prepare", () => {
  test("requires an administrator", async ({ defaults }) => {
    for (const user of [null, defaults.user]) {
      const error = await waitError(() =>
        routerClient.externalSites.scrapeSources.prepare(
          { site: "bourbonculture", apply: true },
          { context: { user } },
        ),
      );
      expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
    }
    expect(await db.select().from(scrapeSources)).toEqual([]);
  });

  test("reports a missing site", async () => {
    const error = await waitError(() => prepare());
    expect(error).toMatchInlineSnapshot(
      `[Error: Bourbon Culture was not found.]`,
    );
    expect(error).toMatchObject({ code: "NOT_FOUND" });
  });

  test("rejects an unsupported site without changing records", async () => {
    const { review } = await setupMigration();
    await expect(
      routerClient.externalSites.scrapeSources.prepare(
        { site: "totalwine", apply: true },
        { context: { user: admin } },
      ),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "This scraper cannot move to saved rules yet.",
    });
    expect(await db.select().from(externalReviews)).toEqual([review]);
    expect(await db.select().from(scrapeSources)).toEqual([]);
  });

  test("rejects an actor supplied by the caller", async () => {
    await expect(
      routerClient.externalSites.scrapeSources.prepare(
        {
          site: "bourbonculture",
          apply: true,
          // @ts-expect-error Actor identity must come from the authenticated request.
          createdById: admin.id,
        },
        { context: { user: admin } },
      ),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(await db.select().from(scrapeSources)).toEqual([]);
  });

  test("migrates review keys in place and preserves history, publication, and request state", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const { site, article, review } = await setupMigration(bottle.id);
    const bodies = await db.select().from(externalReviewBodies);
    const publications = await db.select().from(externalReviewPublications);
    const runs = await db.select().from(externalSiteRuns);
    await db.update(scrapeTargets).set({
      blockedUntil: new Date(Date.now() + 60_000),
      windowRequestCount: 3,
    });
    const [target] = await db.select().from(scrapeTargets);
    const otherSite = await fixtures.ExternalSite({ type: "other-reviews" });
    const other = await fixtures.ExternalReview({
      externalSiteId: otherSite.id,
      name: "Unrelated review",
      bottleId: null,
    });

    await expect(prepare()).resolves.toEqual({
      siteId: site.id,
      scrapeSourceId: null,
      reviewCount: 1,
      applied: false,
    });
    expect(await db.select().from(scrapeSources)).toEqual([]);
    expect(
      await db
        .select()
        .from(externalReviews)
        .where(eq(externalReviews.id, review.id)),
    ).toEqual([review]);
    expect(await db.select().from(scrapeTargets)).toEqual([target]);
    const applied = await prepare({ apply: true });
    expect(applied).toEqual({
      siteId: site.id,
      scrapeSourceId: expect.any(Number),
      reviewCount: 1,
      applied: true,
    });
    // A subsequent deploy must not take the target back or reset its limits.
    await syncScraperDefinitions(registry);
    await syncScraperDefinitions(
      createScraperRegistry({ targets: [], sources: [] }),
    );
    const [stored] = await db
      .select()
      .from(externalReviews)
      .where(eq(externalReviews.id, review.id));
    expect(stored).toEqual({
      ...review,
      sourceKey: `${canonicalUrl}#review-1`,
    });
    expect(
      await db
        .select()
        .from(externalReviews)
        .where(eq(externalReviews.id, other.id)),
    ).toEqual([other]);
    expect(
      await db
        .select()
        .from(externalReviewArticles)
        .where(eq(externalReviewArticles.id, article.id)),
    ).toEqual([article]);
    expect(await db.select().from(externalReviewBodies)).toEqual(bodies);
    expect(await db.select().from(externalReviewPublications)).toEqual(
      publications,
    );
    expect(await db.select().from(externalSiteRuns)).toEqual(runs);
    expect(await db.select().from(scrapeTargets)).toEqual([
      { ...target, managedBy: "admin", updatedAt: expect.any(Date) },
    ]);
    expect(
      await db
        .select()
        .from(externalSites)
        .where(eq(externalSites.id, site.id)),
    ).toEqual([site]);
    expect(await db.select().from(scrapeSources)).toEqual([
      expect.objectContaining({
        id: applied.scrapeSourceId,
        externalSiteId: site.id,
        enabled: false,
        createdById: admin.id,
      }),
    ]);
    await expect(prepare({ apply: true })).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Bourbon Culture is already prepared for saved scraping rules.",
    });
  });

  test("prepares The Whisky Study without replacing its records", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const { site, article, review } = await setupWhiskyStudyMigration(
      bottle.id,
    );
    const bodies = await db.select().from(externalReviewBodies);
    const publications = await db.select().from(externalReviewPublications);
    const runs = await db.select().from(externalSiteRuns);
    const [target] = await db.select().from(scrapeTargets);

    await expect(prepareWhiskyStudy()).resolves.toEqual({
      siteId: site.id,
      scrapeSourceId: null,
      reviewCount: 1,
      applied: false,
    });
    expect(await db.select().from(scrapeSources)).toEqual([]);
    expect(await db.select().from(externalReviews)).toEqual([review]);

    const applied = await prepareWhiskyStudy({ apply: true });
    expect(applied).toEqual({
      siteId: site.id,
      scrapeSourceId: expect.any(Number),
      reviewCount: 1,
      applied: true,
    });
    await syncScraperDefinitions(whiskyStudyRegistry);
    expect(await db.select().from(externalReviewArticles)).toEqual([article]);
    expect(await db.select().from(externalReviews)).toEqual([
      {
        ...review,
        sourceKey: `${whiskyStudyCanonicalUrl}#review-1`,
      },
    ]);
    expect(await db.select().from(externalReviewBodies)).toEqual(bodies);
    expect(await db.select().from(externalReviewPublications)).toEqual(
      publications,
    );
    expect(await db.select().from(externalSiteRuns)).toEqual(runs);
    expect(await db.select().from(scrapeTargets)).toEqual([
      { ...target, managedBy: "admin", updatedAt: expect.any(Date) },
    ]);
    expect(await db.select().from(scrapeSources)).toEqual([
      expect.objectContaining({
        id: applied.scrapeSourceId,
        externalSiteId: site.id,
        kind: "review",
        listUrl: "https://thewhiskystudy.com/reviews-3",
        enabled: false,
        createdById: admin.id,
      }),
    ]);
  });

  test("refuses an unexpected The Whisky Study article URL", async () => {
    const { article } = await setupWhiskyStudyMigration();
    await db
      .update(externalReviewArticles)
      .set({ canonicalUrl: `${whiskyStudyCanonicalUrl}/` })
      .where(eq(externalReviewArticles.id, article.id));
    const reviews = await db.select().from(externalReviews);
    const targets = await db.select().from(scrapeTargets);

    await expect(prepareWhiskyStudy({ apply: true })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining(
        "Check the URL and review records for The Whisky Study article",
      ),
    });
    expect(await db.select().from(externalReviews)).toEqual(reviews);
    expect(await db.select().from(scrapeTargets)).toEqual(targets);
    expect(await db.select().from(scrapeSources)).toEqual([]);
  });

  test.each([
    "schedule",
    "active run",
    "multiple reviews",
    "unknown key",
    "noncanonical URL",
  ])(
    "refuses %s without changing data or source ownership",
    async (failure) => {
      const { site, article, review } = await setupMigration();
      if (failure === "schedule") {
        await db
          .update(externalSites)
          .set({ runEvery: 60 })
          .where(eq(externalSites.id, site.id));
      } else if (failure === "active run") {
        await db
          .insert(externalSiteRuns)
          .values({ externalSiteId: site.id, trigger: "manual" });
      } else if (failure === "multiple reviews") {
        await db.insert(externalReviews).values({
          articleId: article.id,
          name: "Second",
          sourceKey: "second",
        });
      } else if (failure === "unknown key") {
        await db
          .update(externalReviews)
          .set({ sourceKey: "unexpected" })
          .where(eq(externalReviews.id, review.id));
      } else {
        await db
          .update(externalReviewArticles)
          .set({ canonicalUrl: canonicalUrl.slice(0, -1) })
          .where(eq(externalReviewArticles.id, article.id));
      }
      const reviews = await db.select().from(externalReviews);
      const targets = await db.select().from(scrapeTargets);
      await expect(prepare({ apply: true })).rejects.toMatchObject({
        code: ["schedule", "active run"].includes(failure)
          ? "CONFLICT"
          : "BAD_REQUEST",
      });
      expect(await db.select().from(externalReviews)).toEqual(reviews);
      expect(await db.select().from(scrapeTargets)).toEqual(targets);
      expect(await db.select().from(scrapeSources)).toEqual([]);
    },
  );

  test("configured runs replace the old adapter and replay updates the migrated review", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const { site, review } = await setupMigration(bottle.id);
    await prepare({ apply: true });
    const [source] = await db.select().from(scrapeSources);
    const enqueue = vi.fn(async () => undefined);
    const lifecycle = createScraperLifecycle({ registry, enqueue });
    const manual = () =>
      lifecycle.queueManualExternalSiteRun({ site, requestedById: admin.id });
    await expect(manual()).rejects.toBeInstanceOf(ScrapeSourceValidationError);
    expect(enqueue).not.toHaveBeenCalled();

    const suggestion = await createScrapeSourceSuggestionRun({
      scrapeSourceId: source.id,
      requestedById: admin.id,
    });
    const suggestionRegistry = await resolveScrapeSourceRunRegistry(
      suggestion.id,
      registry,
    );
    expect(
      [...suggestionRegistry.sources.values()].map((value) => value.key),
    ).toEqual([`source-${source.id}`]);
    await db
      .update(externalSiteRuns)
      .set({ status: "succeeded", completedAt: new Date() })
      .where(eq(externalSiteRuns.id, suggestion.id));

    const revision = await createScrapeSourceRevision({
      scrapeSourceId: source.id,
      author: "person",
      createdById: admin.id,
      rules: {
        kind: "review",
        list: {
          detailLink: { selector: "a.review", attribute: "href" },
          maxItems: 6,
        },
        detail: {
          title: { selector: "h1" },
          publishedAt: { selector: "time", attribute: "datetime" },
          reviewItem: ".entry-content",
          name: { selector: "h2.name" },
          reviewerName: { selector: ".author" },
          score: { value: { selector: ".score" }, scale: 10 },
        },
      },
    });
    const preview = await lifecycle.queueScrapeSourcePreview({
      site,
      scrapeSourceId: source.id,
      revisionId: revision.id,
      requestedById: admin.id,
    });
    const previewRegistry = await resolveScrapeSourceRunRegistry(
      preview.id,
      registry,
    );
    expect(
      [...previewRegistry.sources.values()].map((value) => value.key),
    ).toEqual([`source-${source.id}`]);
    expect(registry.sources.has("bourbonculture")).toBe(true);
    await db
      .update(externalSiteRuns)
      .set({ status: "succeeded", completedAt: new Date() })
      .where(eq(externalSiteRuns.id, preview.id));
    await recordScrapeSourcePreview({
      revisionId: revision.id,
      status: "passed",
      result: { pages: [], issues: [] },
    });
    await activateScrapeSourceRevision({
      scrapeSourceId: source.id,
      revisionId: revision.id,
    });

    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(input instanceof Request ? input.url : input);
      if (url.pathname === "/robots.txt")
        return new Response("User-agent: *\nAllow: /\n");
      if (url.pathname === "/")
        return new Response(
          `<a class="review" href="${canonicalUrl}">Example</a>`,
        );
      if (url.href === canonicalUrl)
        return new Response(
          '<h1>Example Review</h1><time datetime="2026-08-01"></time><div class="entry-content"><h2 class="name">Example</h2><span class="author">Example Writer</span><p>Synthetic new body.</p><span class="score">9/10</span></div>',
        );
      throw new Error(`Unexpected URL: ${url.href}`);
    });
    let now = new Date();
    const clock = {
      now: () => now,
      sleep: async (ms: number) => {
        now = new Date(now.getTime() + ms);
      },
      random: () => 0,
    };
    for (let attempt = 0; attempt < 2; attempt++) {
      await db
        .update(externalSites)
        .set({ runEvery: 60, nextRunAt: null })
        .where(eq(externalSites.id, site.id));
      const run =
        attempt === 0
          ? await manual()
          : (await lifecycle.queueScheduledExternalSiteRun(site.id))!;
      expect(
        await db
          .select()
          .from(scrapeSourceRuns)
          .where(eq(scrapeSourceRuns.externalSiteRunId, run.id)),
      ).toEqual([
        expect.objectContaining({
          revisionId: revision.id,
          purpose: "collect",
        }),
      ]);
      await expect(
        executeScraperRun(
          { runId: run.id },
          {
            registry,
            fetchImpl,
            clock,
            executionToken: `migration-${attempt}`,
          },
        ),
      ).resolves.toEqual({ status: "completed" });
    }
    expect(await db.select().from(externalReviewArticles)).toHaveLength(1);
    expect(await db.select().from(externalReviews)).toEqual([
      expect.objectContaining({
        id: review.id,
        bottleId: bottle.id,
        hidden: true,
        nativeScoreValue: 9,
        clip: review.clip,
      }),
    ]);
    expect(await db.select().from(externalReviewBodies)).toEqual([
      expect.objectContaining({
        externalReviewId: review.id,
        body: expect.stringContaining("Synthetic new body."),
      }),
    ]);

    await pauseScrapeSource(source.id);
    await expect(manual()).rejects.toBeInstanceOf(ScrapeSourceValidationError);
    await expect(
      routerClient.externalSites.triggerJob(
        { site: site.type },
        { context: { user: admin } },
      ),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await db
      .update(externalSites)
      .set({ runEvery: 60, nextRunAt: null })
      .where(eq(externalSites.id, site.id));
    await expect(
      lifecycle.queueScheduledExternalSiteRun(site.id),
    ).resolves.toBeNull();
    const health = await routerClient.externalSites.healthList(
      {},
      { context: { user: admin } },
    );
    expect(health.results[0].runtime.registered).toBe(false);
    await expect(
      routerClient.externalSites.schedule.update(
        { site: site.type, schedule: { runEvery: 60 } },
        { context: { user: admin } },
      ),
    ).rejects.toThrow("Set up this scraper");
  });
});
