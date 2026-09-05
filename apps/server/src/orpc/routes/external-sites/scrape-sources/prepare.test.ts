import { db } from "@peated/server/db";
import {
  externalReviewArticles,
  externalReviewBodies,
  externalReviewPublications,
  externalReviews,
  externalSiteRuns,
  externalSites,
  externalSiteScrapeTargets,
  scrapeSourceRuns,
  scrapeSources,
  scrapeTargets,
  storePriceHistories,
  storePrices,
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
import {
  createScraperRegistry,
  defineScraperSource,
} from "@peated/server/scraper/definitions";
import { createScraperLifecycle } from "@peated/server/scraper/lifecycle";
import { scraperRegistry } from "@peated/server/scraper/registry";
import { executeScraperRun } from "@peated/server/scraper/runs";
import { syncScraperDefinitions } from "@peated/server/scraper/syncDefinitions";
import { eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { beforeEach, describe, vi } from "vitest";
import { z } from "zod";

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

function prepareWhiskySaga(input: { apply?: boolean } = {}) {
  return routerClient.externalSites.scrapeSources.prepare(
    { site: "whiskysaga", ...input },
    {
      context: { user: admin },
    },
  );
}

function prepareWhiskeyReviewer(input: { apply?: boolean } = {}) {
  return routerClient.externalSites.scrapeSources.prepare(
    { site: "whiskeyreviewer", ...input },
    {
      context: { user: admin },
    },
  );
}

function prepareWordsOfWhisky(input: { apply?: boolean } = {}) {
  return routerClient.externalSites.scrapeSources.prepare(
    { site: "wordsofwhisky", ...input },
    {
      context: { user: admin },
    },
  );
}

function prepareWhiskyNotes(input: { apply?: boolean } = {}) {
  return routerClient.externalSites.scrapeSources.prepare(
    { site: "whiskynotes", ...input },
    {
      context: { user: admin },
    },
  );
}

function prepareCompassBox(input: { apply?: boolean } = {}) {
  return routerClient.externalSites.scrapeSources.prepare(
    { site: "compassbox", ...input },
    {
      context: { user: admin },
    },
  );
}

function prepareKilchoman(input: { apply?: boolean } = {}) {
  return routerClient.externalSites.scrapeSources.prepare(
    { site: "kilchoman", ...input },
    {
      context: { user: admin },
    },
  );
}

const canonicalUrl =
  "https://thebourbonculture.com/whiskey-reviews/example-review/";

function codeOwnedSource(
  key:
    | "bourbonculture"
    | "compassbox"
    | "kilchoman"
    | "whiskeyreviewer"
    | "whiskynotes"
    | "whiskysaga"
    | "whiskystudy"
    | "wordsofwhisky",
) {
  return defineScraperSource({
    key,
    externalSiteKey: key,
    targetKeys: [key],
    cursorSchema: z.null(),
    observationSchema: z.unknown(),
    adapter: async () => {},
    sink: async () => {},
  });
}

const registry = createScraperRegistry({
  targets: [scraperRegistry.targets.get("bourbonculture")!],
  sources: [codeOwnedSource("bourbonculture")],
});

const whiskyStudyCanonicalUrl =
  "https://thewhiskystudy.com/reviews-3/example-scotch-review";
const whiskyStudyRegistry = createScraperRegistry({
  targets: [scraperRegistry.targets.get("whiskystudy")!],
  sources: [codeOwnedSource("whiskystudy")],
});

const whiskySagaCanonicalUrl =
  "https://www.whiskysaga.com/blog/example-scotch-review";
const whiskySagaRegistry = createScraperRegistry({
  targets: [scraperRegistry.targets.get("whiskysaga")!],
  sources: [codeOwnedSource("whiskysaga")],
});

const whiskeyReviewerCanonicalUrl =
  "https://whiskeyreviewer.com/2026/08/example-bourbon-review-081026";
const whiskeyReviewerRegistry = createScraperRegistry({
  targets: [scraperRegistry.targets.get("whiskeyreviewer")!],
  sources: [codeOwnedSource("whiskeyreviewer")],
});

const wordsOfWhiskyCanonicalUrl =
  "https://wordsofwhisky.com/example-multi-bottle-review";
const wordsOfWhiskyRegistry = createScraperRegistry({
  targets: [scraperRegistry.targets.get("wordsofwhisky")!],
  sources: [codeOwnedSource("wordsofwhisky")],
});

const whiskyNotesCanonicalUrl =
  "https://www.whiskynotes.be/2026/example/example-multi-bottle-review/";
const whiskyNotesRegistry = createScraperRegistry({
  targets: [scraperRegistry.targets.get("whiskynotes")!],
  sources: [codeOwnedSource("whiskynotes")],
});

const compassBoxRegistry = createScraperRegistry({
  targets: [scraperRegistry.targets.get("compassbox")!],
  sources: [codeOwnedSource("compassbox")],
});

const kilchomanRegistry = createScraperRegistry({
  targets: [scraperRegistry.targets.get("kilchoman")!],
  sources: [codeOwnedSource("kilchoman")],
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

async function setupWhiskySagaMigration(bottleId: number | null = null) {
  const [site] = await db
    .insert(externalSites)
    .values({
      type: "whiskysaga",
      name: "Whisky Saga",
      runEvery: null,
    })
    .returning();
  await syncScraperDefinitions(whiskySagaRegistry);
  const [article] = await db
    .insert(externalReviewArticles)
    .values({
      externalSiteId: site.id,
      canonicalUrl: whiskySagaCanonicalUrl,
      title: "Example Scotch Review",
      publishedAt: new Date("2026-07-05"),
    })
    .returning();
  const [review] = await db
    .insert(externalReviews)
    .values({
      articleId: article.id,
      sourceKey: `whiskysaga:${createHash("sha256").update(whiskySagaCanonicalUrl).digest("hex")}`,
      name: "Example Scotch",
      bottleId,
      hidden: true,
      reviewerName: "Thomas Øhrbom",
      nativeScoreValue: 89,
      nativeScoreScale: 100,
      nativeScoreDisplay: "89/100",
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

async function setupWhiskeyReviewerMigration(bottleId: number | null = null) {
  const [site] = await db
    .insert(externalSites)
    .values({
      type: "whiskeyreviewer",
      name: "The Whiskey Reviewer",
      runEvery: null,
    })
    .returning();
  await syncScraperDefinitions(whiskeyReviewerRegistry);
  const [article] = await db
    .insert(externalReviewArticles)
    .values({
      externalSiteId: site.id,
      canonicalUrl: whiskeyReviewerCanonicalUrl,
      title: "Example Bourbon Review",
      publishedAt: new Date("2026-08-10"),
    })
    .returning();
  const [review] = await db
    .insert(externalReviews)
    .values({
      articleId: article.id,
      sourceKey: `whiskeyreviewer:${createHash("sha256").update(whiskeyReviewerCanonicalUrl).digest("hex")}`,
      name: "Example Bourbon",
      bottleId,
      hidden: true,
      reviewerName: "Rowan Hill",
      nativeScoreValue: 87,
      nativeScoreScale: 100,
      nativeScoreDisplay: "B+",
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

function wordsOfWhiskyReviewKey(name: string, reviewerName: string | null) {
  const digest = createHash("sha256")
    .update(
      [wordsOfWhiskyCanonicalUrl, name, reviewerName ?? ""]
        .map((value) =>
          value.replaceAll(/\s+/g, " ").trim().toLocaleLowerCase("en"),
        )
        .join("\n"),
    )
    .digest("hex");
  return `wordsofwhisky:${digest}`;
}

async function setupWordsOfWhiskyMigration(bottleIds: [number, number]) {
  const [site] = await db
    .insert(externalSites)
    .values({
      type: "wordsofwhisky",
      name: "Words of Whisky",
      runEvery: null,
    })
    .returning();
  await syncScraperDefinitions(wordsOfWhiskyRegistry);
  const [article] = await db
    .insert(externalReviewArticles)
    .values({
      externalSiteId: site.id,
      canonicalUrl: wordsOfWhiskyCanonicalUrl,
      title: "Two Example Whiskies",
      publishedAt: new Date("2026-08-19"),
    })
    .returning();
  const reviewerName = "Example Writer";
  const reviews = await db
    .insert(externalReviews)
    .values([
      {
        articleId: article.id,
        sourceKey: wordsOfWhiskyReviewKey("First Example", reviewerName),
        name: "First Example",
        reviewerName,
        bottleId: bottleIds[0],
        hidden: true,
        nativeScoreValue: 8.7,
        nativeScoreScale: 10,
        nativeScoreDisplay: "8.7/10",
      },
      {
        articleId: article.id,
        sourceKey: wordsOfWhiskyReviewKey("Second Example", reviewerName),
        name: "Second Example",
        reviewerName,
        bottleId: bottleIds[1],
        hidden: false,
        nativeScoreValue: 9,
        nativeScoreScale: 10,
        nativeScoreDisplay: "9/10",
      },
    ])
    .returning();
  await db.insert(externalReviewBodies).values(
    reviews.map((review) => ({
      externalReviewId: review.id,
      body: `Stored body for ${review.name}.`,
      fetchedAt: new Date(),
    })),
  );
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
  return { site, article, reviews };
}

function whiskyNotesReviewKey(name: string) {
  const normalizedName = name
    .replaceAll(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("en");
  const digest = createHash("sha256")
    .update(`${whiskyNotesCanonicalUrl}\n${normalizedName}`)
    .digest("hex");
  return `whiskynotes:${digest}`;
}

async function setupWhiskyNotesMigration(bottleIds: [number, number]) {
  const [site] = await db
    .insert(externalSites)
    .values({
      type: "whiskynotes",
      name: "WhiskyNotes",
      runEvery: null,
    })
    .returning();
  await syncScraperDefinitions(whiskyNotesRegistry);
  const [article] = await db
    .insert(externalReviewArticles)
    .values({
      externalSiteId: site.id,
      canonicalUrl: whiskyNotesCanonicalUrl,
      title: "Two Example Whiskies",
      publishedAt: new Date("2026-08-20"),
    })
    .returning();
  const reviews = await db
    .insert(externalReviews)
    .values([
      {
        articleId: article.id,
        sourceKey: whiskyNotesReviewKey("First Example (46%)"),
        name: "First Example (46%)",
        reviewerName: "Ruben Luyten",
        bottleId: bottleIds[0],
        hidden: true,
        nativeScoreValue: 88,
        nativeScoreScale: 100,
        nativeScoreDisplay: "88/100",
      },
      {
        articleId: article.id,
        sourceKey: whiskyNotesReviewKey("Second Example (51.2%)"),
        name: "Second Example (51.2%)",
        reviewerName: "Ruben Luyten",
        bottleId: bottleIds[1],
        hidden: false,
        nativeScoreValue: 91,
        nativeScoreScale: 100,
        nativeScoreDisplay: "91/100",
      },
    ])
    .returning();
  await db.insert(externalReviewBodies).values(
    reviews.map((review) => ({
      externalReviewId: review.id,
      body: `Stored body for ${review.name}.`,
      fetchedAt: new Date(),
    })),
  );
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
  return { site, article, reviews };
}

async function setupCompassBoxMigration() {
  const [site] = await db
    .insert(externalSites)
    .values({
      type: "compassbox",
      name: "Compass Box",
      runEvery: null,
    })
    .returning();
  await syncScraperDefinitions(compassBoxRegistry);
  await db.insert(externalSiteRuns).values({
    externalSiteId: site.id,
    status: "succeeded",
    trigger: "scheduled",
    completedAt: new Date(),
  });
  return site;
}

async function setupKilchomanMigration() {
  const [site] = await db
    .insert(externalSites)
    .values({
      type: "kilchoman",
      name: "Kilchoman",
      runEvery: null,
    })
    .returning();
  await syncScraperDefinitions(kilchomanRegistry);
  await db.insert(externalSiteRuns).values({
    externalSiteId: site.id,
    status: "succeeded",
    trigger: "scheduled",
    completedAt: new Date(),
  });
  return site;
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

  test("prepares Whisky Saga without replacing its records", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const { site, article, review } = await setupWhiskySagaMigration(bottle.id);
    const bodies = await db.select().from(externalReviewBodies);
    const publications = await db.select().from(externalReviewPublications);
    const runs = await db.select().from(externalSiteRuns);
    const [target] = await db.select().from(scrapeTargets);

    await expect(prepareWhiskySaga()).resolves.toEqual({
      siteId: site.id,
      scrapeSourceId: null,
      reviewCount: 1,
      applied: false,
    });
    expect(await db.select().from(scrapeSources)).toEqual([]);
    expect(await db.select().from(externalReviews)).toEqual([review]);

    const applied = await prepareWhiskySaga({ apply: true });
    expect(applied).toEqual({
      siteId: site.id,
      scrapeSourceId: expect.any(Number),
      reviewCount: 1,
      applied: true,
    });
    await syncScraperDefinitions(whiskySagaRegistry);
    expect(await db.select().from(externalReviewArticles)).toEqual([article]);
    expect(await db.select().from(externalReviews)).toEqual([
      {
        ...review,
        sourceKey: `${whiskySagaCanonicalUrl}#review-1`,
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
        listUrl: "https://www.whiskysaga.com/blog/category/Scotland",
        enabled: false,
        createdById: admin.id,
      }),
    ]);
  });

  test("prepares The Whiskey Reviewer without replacing its records", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const { site, article, review } = await setupWhiskeyReviewerMigration(
      bottle.id,
    );
    const bodies = await db.select().from(externalReviewBodies);
    const publications = await db.select().from(externalReviewPublications);
    const runs = await db.select().from(externalSiteRuns);
    const [target] = await db.select().from(scrapeTargets);

    await expect(prepareWhiskeyReviewer()).resolves.toEqual({
      siteId: site.id,
      scrapeSourceId: null,
      reviewCount: 1,
      applied: false,
    });
    expect(await db.select().from(scrapeSources)).toEqual([]);
    expect(await db.select().from(externalReviews)).toEqual([review]);

    const applied = await prepareWhiskeyReviewer({ apply: true });
    expect(applied).toEqual({
      siteId: site.id,
      scrapeSourceId: expect.any(Number),
      reviewCount: 1,
      applied: true,
    });
    await syncScraperDefinitions(whiskeyReviewerRegistry);
    expect(await db.select().from(externalReviewArticles)).toEqual([article]);
    expect(await db.select().from(externalReviews)).toEqual([
      {
        ...review,
        sourceKey: `${whiskeyReviewerCanonicalUrl}#review-1`,
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
        listUrl: "https://whiskeyreviewer.com/",
        enabled: false,
        createdById: admin.id,
      }),
    ]);
  });

  test("prepares Words of Whisky without replacing multi-review records", async ({
    fixtures,
  }) => {
    const firstBottle = await fixtures.Bottle();
    const secondBottle = await fixtures.Bottle();
    const { site, article, reviews } = await setupWordsOfWhiskyMigration([
      firstBottle.id,
      secondBottle.id,
    ]);
    const bodies = await db.select().from(externalReviewBodies);
    const publications = await db.select().from(externalReviewPublications);
    const runs = await db.select().from(externalSiteRuns);
    const [target] = await db.select().from(scrapeTargets);

    await expect(prepareWordsOfWhisky()).resolves.toEqual({
      siteId: site.id,
      scrapeSourceId: null,
      reviewCount: 2,
      applied: false,
    });
    expect(await db.select().from(scrapeSources)).toEqual([]);
    expect(await db.select().from(externalReviews)).toEqual(reviews);

    const applied = await prepareWordsOfWhisky({ apply: true });
    expect(applied).toEqual({
      siteId: site.id,
      scrapeSourceId: expect.any(Number),
      reviewCount: 2,
      applied: true,
    });
    await syncScraperDefinitions(wordsOfWhiskyRegistry);
    expect(await db.select().from(externalReviewArticles)).toEqual([article]);
    expect(await db.select().from(externalReviews)).toEqual([
      { ...reviews[0], sourceKey: `${wordsOfWhiskyCanonicalUrl}#review-1` },
      { ...reviews[1], sourceKey: `${wordsOfWhiskyCanonicalUrl}#review-2` },
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
        listUrl: "https://wordsofwhisky.com/",
        enabled: false,
        createdById: admin.id,
      }),
    ]);
  });

  test("refuses an unknown Words of Whisky review key", async ({
    fixtures,
  }) => {
    const firstBottle = await fixtures.Bottle();
    const secondBottle = await fixtures.Bottle();
    const { reviews } = await setupWordsOfWhiskyMigration([
      firstBottle.id,
      secondBottle.id,
    ]);
    await db
      .update(externalReviews)
      .set({ sourceKey: "unexpected" })
      .where(eq(externalReviews.id, reviews[1].id));
    const before = await db.select().from(externalReviews);
    const targets = await db.select().from(scrapeTargets);

    await expect(prepareWordsOfWhisky({ apply: true })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining(
        "Check the URL and review records for Words of Whisky article",
      ),
    });
    expect(await db.select().from(externalReviews)).toEqual(before);
    expect(await db.select().from(scrapeTargets)).toEqual(targets);
    expect(await db.select().from(scrapeSources)).toEqual([]);
  });

  test("prepares WhiskyNotes without replacing multi-review records", async ({
    fixtures,
  }) => {
    const firstBottle = await fixtures.Bottle();
    const secondBottle = await fixtures.Bottle();
    const { site, article, reviews } = await setupWhiskyNotesMigration([
      firstBottle.id,
      secondBottle.id,
    ]);
    const bodies = await db.select().from(externalReviewBodies);
    const publications = await db.select().from(externalReviewPublications);
    const runs = await db.select().from(externalSiteRuns);
    const [target] = await db.select().from(scrapeTargets);

    await expect(prepareWhiskyNotes()).resolves.toEqual({
      siteId: site.id,
      scrapeSourceId: null,
      reviewCount: 2,
      applied: false,
    });
    expect(await db.select().from(scrapeSources)).toEqual([]);
    expect(await db.select().from(externalReviews)).toEqual(reviews);

    const applied = await prepareWhiskyNotes({ apply: true });
    expect(applied).toEqual({
      siteId: site.id,
      scrapeSourceId: expect.any(Number),
      reviewCount: 2,
      applied: true,
    });
    await syncScraperDefinitions(whiskyNotesRegistry);
    expect(await db.select().from(externalReviewArticles)).toEqual([article]);
    expect(await db.select().from(externalReviews)).toEqual([
      { ...reviews[0], sourceKey: `${whiskyNotesCanonicalUrl}#review-1` },
      { ...reviews[1], sourceKey: `${whiskyNotesCanonicalUrl}#review-2` },
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
        listUrl: "https://www.whiskynotes.be/",
        enabled: false,
        createdById: admin.id,
      }),
    ]);
  });

  test("refuses an unknown WhiskyNotes review key", async ({ fixtures }) => {
    const firstBottle = await fixtures.Bottle();
    const secondBottle = await fixtures.Bottle();
    const { reviews } = await setupWhiskyNotesMigration([
      firstBottle.id,
      secondBottle.id,
    ]);
    await db
      .update(externalReviews)
      .set({ sourceKey: "unexpected" })
      .where(eq(externalReviews.id, reviews[1].id));
    const before = await db.select().from(externalReviews);
    const targets = await db.select().from(scrapeTargets);

    await expect(prepareWhiskyNotes({ apply: true })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining(
        "Check the URL and review records for WhiskyNotes article",
      ),
    });
    expect(await db.select().from(externalReviews)).toEqual(before);
    expect(await db.select().from(scrapeTargets)).toEqual(targets);
    expect(await db.select().from(scrapeSources)).toEqual([]);
  });

  test("refuses an unexpected WhiskyNotes article URL", async ({
    fixtures,
  }) => {
    const firstBottle = await fixtures.Bottle();
    const secondBottle = await fixtures.Bottle();
    const { article } = await setupWhiskyNotesMigration([
      firstBottle.id,
      secondBottle.id,
    ]);
    await db
      .update(externalReviewArticles)
      .set({ canonicalUrl: "https://www.whiskynotes.be/about/" })
      .where(eq(externalReviewArticles.id, article.id));

    await expect(prepareWhiskyNotes({ apply: true })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining(
        "Check the URL and review records for WhiskyNotes article",
      ),
    });
    expect(await db.select().from(scrapeSources)).toEqual([]);
  });

  test("prepares Compass Box without replacing prices or Bottle matches", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const site = await setupCompassBoxMigration();
    await fixtures.StorePrice({
      externalSiteId: site.id,
      name: "Compass Box Orchard House",
      price: 4500,
      currency: "gbp",
      volume: 700,
      url: "https://www.compassboxwhisky.com/products/orchard-house",
      bottleId: bottle.id,
    });
    await fixtures.StorePrice({
      externalSiteId: site.id,
      name: "Compass Box Hedonism",
      price: 8500,
      currency: "gbp",
      volume: 700,
      url: "https://www.compassboxwhisky.com/products/hedonism",
      bottleId: null,
      hidden: true,
    });
    const prices = await db.select().from(storePrices);
    const histories = await db.select().from(storePriceHistories);
    const runs = await db.select().from(externalSiteRuns);
    // Retiring a code source leaves its request target in place but makes the
    // site link inactive until saved rules take ownership.
    await syncScraperDefinitions(
      createScraperRegistry({
        targets: [scraperRegistry.targets.get("compassbox")!],
        sources: [],
      }),
    );
    expect(await db.select().from(externalSiteScrapeTargets)).toEqual([
      expect.objectContaining({
        externalSiteId: site.id,
        targetKey: "compassbox",
        managedBy: "code",
        active: false,
      }),
    ]);
    await db.update(scrapeTargets).set({
      blockedUntil: new Date(Date.now() + 60_000),
      windowRequestCount: 3,
    });
    const [target] = await db.select().from(scrapeTargets);

    await expect(prepareCompassBox()).resolves.toEqual({
      siteId: site.id,
      scrapeSourceId: null,
      priceCount: 2,
      visiblePriceCount: 1,
      matchedPriceCount: 1,
      applied: false,
    });
    expect(await db.select().from(scrapeSources)).toEqual([]);
    expect(await db.select().from(storePrices)).toEqual(prices);

    const applied = await prepareCompassBox({ apply: true });
    expect(applied).toEqual({
      siteId: site.id,
      scrapeSourceId: expect.any(Number),
      priceCount: 2,
      visiblePriceCount: 1,
      matchedPriceCount: 1,
      applied: true,
    });
    // A later definition sync must not reclaim the transferred target.
    await syncScraperDefinitions(compassBoxRegistry);
    await syncScraperDefinitions(
      createScraperRegistry({ targets: [], sources: [] }),
    );
    expect(await db.select().from(storePrices)).toEqual(prices);
    expect(await db.select().from(storePriceHistories)).toEqual(histories);
    expect(await db.select().from(externalSiteRuns)).toEqual(runs);
    expect(await db.select().from(scrapeTargets)).toEqual([
      { ...target, managedBy: "admin", updatedAt: expect.any(Date) },
    ]);
    expect(await db.select().from(externalSiteScrapeTargets)).toEqual([
      expect.objectContaining({
        externalSiteId: site.id,
        targetKey: "compassbox",
        managedBy: "admin",
        active: true,
      }),
    ]);
    expect(await db.select().from(scrapeSources)).toEqual([
      expect.objectContaining({
        id: applied.scrapeSourceId,
        externalSiteId: site.id,
        kind: "price",
        listUrl: "https://www.compassboxwhisky.com/collections",
        enabled: false,
        createdById: admin.id,
      }),
    ]);
    await expect(prepareCompassBox({ apply: true })).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Compass Box is already prepared for saved scraping rules.",
    });
  });

  test("refuses an unexpected Compass Box price without changing records", async ({
    fixtures,
  }) => {
    const site = await setupCompassBoxMigration();
    await fixtures.StorePrice({
      externalSiteId: site.id,
      name: "Compass Box Orchard House",
      currency: "gbp",
      volume: 700,
      url: "https://example.com/products/orchard-house",
      bottleId: null,
    });
    const prices = await db.select().from(storePrices);
    const targets = await db.select().from(scrapeTargets);

    await expect(prepareCompassBox({ apply: true })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("Check Compass Box price"),
    });
    expect(await db.select().from(storePrices)).toEqual(prices);
    expect(await db.select().from(scrapeTargets)).toEqual(targets);
    expect(await db.select().from(scrapeSources)).toEqual([]);
  });

  test("refuses Compass Box without stored prices", async () => {
    await setupCompassBoxMigration();

    await expect(prepareCompassBox({ apply: true })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Compass Box has no stored prices to verify.",
    });
    expect(await db.select().from(scrapeSources)).toEqual([]);
  });

  test("prepares Kilchoman without replacing prices or Bottle matches", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const site = await setupKilchomanMigration();
    await fixtures.StorePrice({
      externalSiteId: site.id,
      name: "Kilchoman Machir Bay 70cl",
      price: 4990,
      currency: "gbp",
      volume: 700,
      url: "https://www.kilchomandistillery.com/our-whisky/machir-bay/",
      bottleId: bottle.id,
    });
    await fixtures.StorePrice({
      externalSiteId: site.id,
      name: "Kilchoman Rockside 11 Years Old",
      price: 5500,
      currency: "gbp",
      volume: 700,
      url: "https://www.kilchomandistillery.com/our-whisky/rockside-11-years-old/",
      bottleId: null,
      hidden: true,
    });
    const prices = await db.select().from(storePrices);
    const histories = await db.select().from(storePriceHistories);
    const runs = await db.select().from(externalSiteRuns);
    const [target] = await db.select().from(scrapeTargets);

    await expect(prepareKilchoman()).resolves.toEqual({
      siteId: site.id,
      scrapeSourceId: null,
      priceCount: 2,
      visiblePriceCount: 1,
      matchedPriceCount: 1,
      applied: false,
    });
    expect(await db.select().from(scrapeSources)).toEqual([]);
    expect(await db.select().from(storePrices)).toEqual(prices);

    const applied = await prepareKilchoman({ apply: true });
    expect(applied).toEqual({
      siteId: site.id,
      scrapeSourceId: expect.any(Number),
      priceCount: 2,
      visiblePriceCount: 1,
      matchedPriceCount: 1,
      applied: true,
    });
    await syncScraperDefinitions(kilchomanRegistry);
    expect(await db.select().from(storePrices)).toEqual(prices);
    expect(await db.select().from(storePriceHistories)).toEqual(histories);
    expect(await db.select().from(externalSiteRuns)).toEqual(runs);
    expect(await db.select().from(scrapeTargets)).toEqual([
      { ...target, managedBy: "admin", updatedAt: expect.any(Date) },
    ]);
    expect(await db.select().from(scrapeSources)).toEqual([
      expect.objectContaining({
        id: applied.scrapeSourceId,
        externalSiteId: site.id,
        kind: "price",
        listUrl: "https://www.kilchomandistillery.com/whisky-shop/",
        enabled: false,
        createdById: admin.id,
      }),
    ]);
    await expect(prepareKilchoman({ apply: true })).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Kilchoman is already prepared for saved scraping rules.",
    });
  });

  test("refuses an unexpected Kilchoman price without changing records", async ({
    fixtures,
  }) => {
    const site = await setupKilchomanMigration();
    await fixtures.StorePrice({
      externalSiteId: site.id,
      name: "Kilchoman Machir Bay 70cl",
      currency: "gbp",
      volume: 700,
      url: "https://example.com/our-whisky/machir-bay/",
      bottleId: null,
    });
    const prices = await db.select().from(storePrices);
    const targets = await db.select().from(scrapeTargets);

    await expect(prepareKilchoman({ apply: true })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("Check Kilchoman price"),
    });
    expect(await db.select().from(storePrices)).toEqual(prices);
    expect(await db.select().from(scrapeTargets)).toEqual(targets);
    expect(await db.select().from(scrapeSources)).toEqual([]);
  });

  test("refuses Kilchoman without stored prices", async () => {
    await setupKilchomanMigration();

    await expect(prepareKilchoman({ apply: true })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Kilchoman has no stored prices to verify.",
    });
    expect(await db.select().from(scrapeSources)).toEqual([]);
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

  test("refuses an unexpected The Whiskey Reviewer article URL", async () => {
    const { article } = await setupWhiskeyReviewerMigration();
    await db
      .update(externalReviewArticles)
      .set({ canonicalUrl: `${whiskeyReviewerCanonicalUrl}/` })
      .where(eq(externalReviewArticles.id, article.id));
    const reviews = await db.select().from(externalReviews);
    const targets = await db.select().from(scrapeTargets);

    await expect(prepareWhiskeyReviewer({ apply: true })).rejects.toMatchObject(
      {
        code: "BAD_REQUEST",
        message: expect.stringContaining(
          "Check the URL and review records for The Whiskey Reviewer article",
        ),
      },
    );
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
        articles: {
          oneArticlePer: "body",
          link: "a.review",
          skipWhen: null,
          nextPage: null,
          limit: 6,
        },
        article: {
          canonicalUrl: null,
          title: {
            try: [
              {
                get: "text",
                selector: "h1",
                take: "first",
                startsWith: null,
                clean: null,
              },
            ],
          },
          publishedDate: {
            try: [
              {
                get: "attribute",
                selector: "time",
                attribute: "datetime",
                clean: null,
              },
            ],
          },
          reviews: {
            inside: "body",
            oneReviewPer: "element",
            selector: ".entry-content",
            name: {
              try: [
                {
                  get: "text",
                  from: "review",
                  selector: "h2.name",
                  take: "first",
                  startsWith: null,
                  clean: null,
                },
              ],
            },
            reviewer: {
              try: [
                {
                  get: "text",
                  from: "review",
                  selector: ".author",
                  take: "first",
                  startsWith: null,
                  clean: null,
                },
              ],
            },
            tastingNotes: null,
            score: {
              try: [
                {
                  get: "text",
                  from: "review",
                  selector: ".score",
                  take: "first",
                  startsWith: null,
                  clean: null,
                },
              ],
              scale: 10,
              map: null,
            },
          },
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
