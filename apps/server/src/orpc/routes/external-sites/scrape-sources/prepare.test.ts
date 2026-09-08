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
import { reviewSourceKey } from "@peated/server/scraper/configured/reviewSourceKey";
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

function prepareWhiskyfun(input: { apply?: boolean } = {}) {
  return routerClient.externalSites.scrapeSources.prepare(
    { site: "whiskyfun", ...input },
    {
      context: { user: admin },
    },
  );
}

function prepareDramface(input: { apply?: boolean } = {}) {
  return routerClient.externalSites.scrapeSources.prepare(
    { site: "dramface", ...input },
    {
      context: { user: admin },
    },
  );
}

function prepareEdradour(input: { apply?: boolean } = {}) {
  return routerClient.externalSites.scrapeSources.prepare(
    { site: "edradour", ...input },
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

function prepareCadenheads(input: { apply?: boolean } = {}) {
  return routerClient.externalSites.scrapeSources.prepare(
    { site: "cadenheads", ...input },
    {
      context: { user: admin },
    },
  );
}

function prepareBruichladdich(input: { apply?: boolean } = {}) {
  return routerClient.externalSites.scrapeSources.prepare(
    { site: "bruichladdich", ...input },
    {
      context: { user: admin },
    },
  );
}

function prepareGordonMacphail(input: { apply?: boolean } = {}) {
  return routerClient.externalSites.scrapeSources.prepare(
    { site: "gordonmacphail", ...input },
    {
      context: { user: admin },
    },
  );
}

function prepareGlenAllachie(input: { apply?: boolean } = {}) {
  return routerClient.externalSites.scrapeSources.prepare(
    { site: "glenallachie", ...input },
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

function prepareNorthStar(input: { apply?: boolean } = {}) {
  return routerClient.externalSites.scrapeSources.prepare(
    { site: "northstarspirits", ...input },
    {
      context: { user: admin },
    },
  );
}

function prepareNcnean(input: { apply?: boolean } = {}) {
  return routerClient.externalSites.scrapeSources.prepare(
    { site: "ncnean", ...input },
    {
      context: { user: admin },
    },
  );
}

function prepareThompsonBros(input: { apply?: boolean } = {}) {
  return routerClient.externalSites.scrapeSources.prepare(
    { site: "thompsonbros", ...input },
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
    | "bruichladdich"
    | "cadenheads"
    | "compassbox"
    | "dramface"
    | "edradour"
    | "glenallachie"
    | "gordonmacphail"
    | "kilchoman"
    | "ncnean"
    | "northstarspirits"
    | "thompsonbros"
    | "whiskeyreviewer"
    | "whiskyfun"
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

const whiskyfunRegistry = createScraperRegistry({
  targets: [scraperRegistry.targets.get("whiskyfun")!],
  sources: [codeOwnedSource("whiskyfun")],
});

const dramfaceCanonicalUrl =
  "https://www.dramface.com/all-reviews/2026/example-multi-bottle-review";
const dramfaceRegistry = createScraperRegistry({
  targets: [scraperRegistry.targets.get("dramface")!],
  sources: [codeOwnedSource("dramface")],
});

const edradourRegistry = createScraperRegistry({
  targets: [scraperRegistry.targets.get("edradour")!],
  sources: [codeOwnedSource("edradour")],
});

const compassBoxRegistry = createScraperRegistry({
  targets: [scraperRegistry.targets.get("compassbox")!],
  sources: [codeOwnedSource("compassbox")],
});

const cadenheadsRegistry = createScraperRegistry({
  targets: [scraperRegistry.targets.get("cadenheads")!],
  sources: [codeOwnedSource("cadenheads")],
});

const bruichladdichRegistry = createScraperRegistry({
  targets: [scraperRegistry.targets.get("bruichladdich")!],
  sources: [codeOwnedSource("bruichladdich")],
});

const gordonMacphailRegistry = createScraperRegistry({
  targets: [scraperRegistry.targets.get("gordonmacphail")!],
  sources: [codeOwnedSource("gordonmacphail")],
});

const glenAllachieRegistry = createScraperRegistry({
  targets: [scraperRegistry.targets.get("glenallachie")!],
  sources: [codeOwnedSource("glenallachie")],
});

const kilchomanRegistry = createScraperRegistry({
  targets: [scraperRegistry.targets.get("kilchoman")!],
  sources: [codeOwnedSource("kilchoman")],
});

const northStarRegistry = createScraperRegistry({
  targets: [scraperRegistry.targets.get("northstarspirits")!],
  sources: [codeOwnedSource("northstarspirits")],
});

const ncneanRegistry = createScraperRegistry({
  targets: [scraperRegistry.targets.get("ncnean")!],
  sources: [codeOwnedSource("ncnean")],
});

const thompsonBrosRegistry = createScraperRegistry({
  targets: [scraperRegistry.targets.get("thompsonbros")!],
  sources: [codeOwnedSource("thompsonbros")],
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

function dramfaceReviewKey(name: string, reviewerName: string | null) {
  const digest = createHash("sha256")
    .update(
      [dramfaceCanonicalUrl, name, reviewerName ?? ""]
        .map((value) =>
          value.replaceAll(/\s+/g, " ").trim().toLocaleLowerCase("en"),
        )
        .join("\n"),
    )
    .digest("hex");
  return `dramface:${digest}`;
}

async function setupDramfaceMigration(bottleIds: [number, number]) {
  const [site] = await db
    .insert(externalSites)
    .values({ type: "dramface", name: "Dramface", runEvery: null })
    .returning();
  await syncScraperDefinitions(dramfaceRegistry);
  const [article] = await db
    .insert(externalReviewArticles)
    .values({
      externalSiteId: site.id,
      canonicalUrl: dramfaceCanonicalUrl,
      title: "Two Example Whiskies",
      publishedAt: new Date("2026-08-20"),
    })
    .returning();
  const reviews = await db
    .insert(externalReviews)
    .values([
      {
        articleId: article.id,
        sourceKey: dramfaceReviewKey("First Example", "Ogilvie"),
        name: "First Example",
        reviewerName: "Ogilvie",
        bottleId: bottleIds[0],
        hidden: true,
        nativeScoreValue: 8,
        nativeScoreScale: 10,
        nativeScoreDisplay: "8/10",
      },
      {
        articleId: article.id,
        sourceKey: dramfaceReviewKey("Second Example", "Broddy"),
        name: "Second Example",
        reviewerName: "Broddy",
        bottleId: bottleIds[1],
        hidden: false,
        nativeScoreValue: 7,
        nativeScoreScale: 10,
        nativeScoreDisplay: "7/10",
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

async function setupWhiskyfunMigration(bottleIds: [number, number]) {
  const [site] = await db
    .insert(externalSites)
    .values({ type: "whiskyfun", name: "Whiskyfun", runEvery: null })
    .returning();
  await syncScraperDefinitions(whiskyfunRegistry);
  const articles = await db
    .insert(externalReviewArticles)
    .values([
      {
        externalSiteId: site.id,
        canonicalUrl:
          "https://www.whiskyfun.com/2026/A-little-example-trio.html",
        title: "A little example trio",
        publishedAt: new Date("2026-09-07"),
      },
      {
        externalSiteId: site.id,
        canonicalUrl:
          "https://www.whiskyfun.com/archivejuly26-1-Caol-Ila.html#080726",
        title: "A small example session",
        publishedAt: new Date("2026-07-08"),
      },
    ])
    .returning();
  const reviews = await db
    .insert(externalReviews)
    .values([
      {
        articleId: articles[0]!.id,
        sourceKey: `whiskyfun:${"a".repeat(64)}`,
        name: "First Example (46%)",
        reviewerName: "Serge Valentin",
        bottleId: bottleIds[0],
        hidden: true,
        nativeScoreValue: 88,
        nativeScoreScale: 100,
        nativeScoreDisplay: "88 points",
      },
      {
        articleId: articles[1]!.id,
        sourceKey: `whiskyfun:${"b".repeat(64)}`,
        name: "Second Example (51.2%)",
        reviewerName: "Serge Valentin",
        bottleId: bottleIds[1],
        hidden: false,
        nativeScoreValue: 91,
        nativeScoreScale: 100,
        nativeScoreDisplay: "91 points",
      },
    ])
    .returning();
  return { site, articles, reviews };
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

async function setupEdradourMigration() {
  const [site] = await db
    .insert(externalSites)
    .values({
      type: "edradour",
      name: "Edradour",
      runEvery: null,
    })
    .returning();
  await syncScraperDefinitions(edradourRegistry);
  await db.insert(externalSiteRuns).values({
    externalSiteId: site.id,
    status: "succeeded",
    trigger: "scheduled",
    completedAt: new Date(),
  });
  return site;
}

async function setupCadenheadsMigration() {
  const [site] = await db
    .insert(externalSites)
    .values({
      type: "cadenheads",
      name: "Cadenheads",
      runEvery: null,
    })
    .returning();
  await syncScraperDefinitions(cadenheadsRegistry);
  await db.insert(externalSiteRuns).values({
    externalSiteId: site.id,
    status: "succeeded",
    trigger: "scheduled",
    completedAt: new Date(),
  });
  return site;
}

async function setupBruichladdichMigration() {
  const [site] = await db
    .insert(externalSites)
    .values({
      type: "bruichladdich",
      name: "Bruichladdich",
      runEvery: null,
    })
    .returning();
  await syncScraperDefinitions(bruichladdichRegistry);
  await db.insert(externalSiteRuns).values({
    externalSiteId: site.id,
    status: "succeeded",
    trigger: "scheduled",
    completedAt: new Date(),
  });
  return site;
}

async function setupGordonMacphailMigration() {
  const [site] = await db
    .insert(externalSites)
    .values({
      type: "gordonmacphail",
      name: "Gordon Macphail",
      runEvery: null,
    })
    .returning();
  await syncScraperDefinitions(gordonMacphailRegistry);
  await db.insert(externalSiteRuns).values({
    externalSiteId: site.id,
    status: "succeeded",
    trigger: "scheduled",
    completedAt: new Date(),
  });
  return site;
}

async function setupGlenAllachieMigration() {
  const [site] = await db
    .insert(externalSites)
    .values({
      type: "glenallachie",
      name: "GlenAllachie",
      runEvery: null,
    })
    .returning();
  await syncScraperDefinitions(glenAllachieRegistry);
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

async function setupNorthStarMigration() {
  const [site] = await db
    .insert(externalSites)
    .values({
      type: "northstarspirits",
      name: "North Star",
      runEvery: null,
    })
    .returning();
  await syncScraperDefinitions(northStarRegistry);
  await db.insert(externalSiteRuns).values({
    externalSiteId: site.id,
    status: "succeeded",
    trigger: "scheduled",
    completedAt: new Date(),
  });
  return site;
}

async function setupNcneanMigration() {
  const [site] = await db
    .insert(externalSites)
    .values({
      type: "ncnean",
      name: "Nc'nean",
      runEvery: null,
    })
    .returning();
  await syncScraperDefinitions(ncneanRegistry);
  await db.insert(externalSiteRuns).values({
    externalSiteId: site.id,
    status: "succeeded",
    trigger: "scheduled",
    completedAt: new Date(),
  });
  return site;
}

async function setupThompsonBrosMigration() {
  const [site] = await db
    .insert(externalSites)
    .values({
      type: "thompsonbros",
      name: "Thompson Bros.",
      runEvery: null,
    })
    .returning();
  await syncScraperDefinitions(thompsonBrosRegistry);
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
      sourceKey: reviewSourceKey(review.name, review.reviewerName),
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
        sourceKey: reviewSourceKey(review.name, review.reviewerName),
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
        sourceKey: reviewSourceKey(review.name, review.reviewerName),
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
        sourceKey: reviewSourceKey(review.name, review.reviewerName),
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
      {
        ...reviews[0],
        sourceKey: reviewSourceKey(reviews[0].name, reviews[0].reviewerName),
      },
      {
        ...reviews[1],
        sourceKey: reviewSourceKey(reviews[1].name, reviews[1].reviewerName),
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

  test("prepares Dramface without replacing multi-review records", async ({
    fixtures,
  }) => {
    const firstBottle = await fixtures.Bottle();
    const secondBottle = await fixtures.Bottle();
    const { site, article, reviews } = await setupDramfaceMigration([
      firstBottle.id,
      secondBottle.id,
    ]);
    const bodies = await db.select().from(externalReviewBodies);
    const publications = await db.select().from(externalReviewPublications);
    const runs = await db.select().from(externalSiteRuns);
    const [target] = await db.select().from(scrapeTargets);

    await expect(prepareDramface()).resolves.toEqual({
      siteId: site.id,
      scrapeSourceId: null,
      reviewCount: 2,
      applied: false,
    });
    expect(await db.select().from(scrapeSources)).toEqual([]);
    expect(await db.select().from(externalReviews)).toEqual(reviews);

    const applied = await prepareDramface({ apply: true });
    expect(applied).toEqual({
      siteId: site.id,
      scrapeSourceId: expect.any(Number),
      reviewCount: 2,
      applied: true,
    });
    await syncScraperDefinitions(dramfaceRegistry);
    expect(await db.select().from(externalReviewArticles)).toEqual([article]);
    expect(await db.select().from(externalReviews)).toEqual([
      {
        ...reviews[0],
        sourceKey: reviewSourceKey(reviews[0].name, reviews[0].reviewerName),
      },
      {
        ...reviews[1],
        sourceKey: reviewSourceKey(reviews[1].name, reviews[1].reviewerName),
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
        listUrl: "https://www.dramface.com/all-reviews",
        enabled: false,
        createdById: admin.id,
      }),
    ]);
  });

  test("prepares repeated Dramface review identities", async ({ fixtures }) => {
    const firstBottle = await fixtures.Bottle();
    const secondBottle = await fixtures.Bottle();
    const { reviews } = await setupDramfaceMigration([
      firstBottle.id,
      secondBottle.id,
    ]);
    await db
      .update(externalReviews)
      .set({
        name: reviews[0].name,
        reviewerName: reviews[0].reviewerName,
        sourceKey: `dramface:${"a".repeat(64)}`,
      })
      .where(eq(externalReviews.id, reviews[1].id));

    await expect(prepareDramface({ apply: true })).resolves.toMatchObject({
      reviewCount: 2,
      applied: true,
    });
    expect(
      await db
        .select({ sourceKey: externalReviews.sourceKey })
        .from(externalReviews)
        .orderBy(externalReviews.id),
    ).toEqual([
      { sourceKey: reviewSourceKey(reviews[0].name, reviews[0].reviewerName) },
      {
        sourceKey: reviewSourceKey(reviews[0].name, reviews[0].reviewerName, 2),
      },
    ]);
  });

  test("refuses an unknown Dramface review key", async ({ fixtures }) => {
    const firstBottle = await fixtures.Bottle();
    const secondBottle = await fixtures.Bottle();
    const { reviews } = await setupDramfaceMigration([
      firstBottle.id,
      secondBottle.id,
    ]);
    await db
      .update(externalReviews)
      .set({ sourceKey: "unexpected" })
      .where(eq(externalReviews.id, reviews[1].id));
    const before = await db.select().from(externalReviews);
    const targets = await db.select().from(scrapeTargets);

    await expect(prepareDramface({ apply: true })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining(
        "Check the URL and review records for Dramface article",
      ),
    });
    expect(await db.select().from(externalReviews)).toEqual(before);
    expect(await db.select().from(scrapeTargets)).toEqual(targets);
    expect(await db.select().from(scrapeSources)).toEqual([]);
  });

  test("prepares Whiskyfun without replacing current or archive reviews", async ({
    fixtures,
  }) => {
    const firstBottle = await fixtures.Bottle();
    const secondBottle = await fixtures.Bottle();
    const { site, articles, reviews } = await setupWhiskyfunMigration([
      firstBottle.id,
      secondBottle.id,
    ]);

    await expect(prepareWhiskyfun()).resolves.toEqual({
      siteId: site.id,
      scrapeSourceId: null,
      reviewCount: 2,
      applied: false,
    });
    expect(await db.select().from(scrapeSources)).toEqual([]);
    expect(await db.select().from(externalReviews)).toEqual(reviews);

    const applied = await prepareWhiskyfun({ apply: true });
    expect(applied).toEqual({
      siteId: site.id,
      scrapeSourceId: expect.any(Number),
      reviewCount: 2,
      applied: true,
    });
    await syncScraperDefinitions(whiskyfunRegistry);
    expect(await db.select().from(externalReviewArticles)).toEqual(articles);
    expect(await db.select().from(externalReviews)).toEqual([
      {
        ...reviews[0],
        sourceKey: reviewSourceKey(reviews[0].name, reviews[0].reviewerName),
      },
      {
        ...reviews[1],
        sourceKey: reviewSourceKey(reviews[1].name, reviews[1].reviewerName),
      },
    ]);
    expect(await db.select().from(scrapeSources)).toEqual([
      expect.objectContaining({
        id: applied.scrapeSourceId,
        externalSiteId: site.id,
        kind: "review",
        listUrl: "https://www.whiskyfun.com/whatsnew.xml",
        enabled: false,
        createdById: admin.id,
      }),
    ]);
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
      {
        ...reviews[0],
        sourceKey: reviewSourceKey(reviews[0].name, reviews[0].reviewerName),
      },
      {
        ...reviews[1],
        sourceKey: reviewSourceKey(reviews[1].name, reviews[1].reviewerName),
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

  test("prepares Edradour without replacing prices or Bottle matches", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const site = await setupEdradourMigration();
    await fixtures.StorePrice({
      externalSiteId: site.id,
      name: "Ballechin 10-year-old",
      price: 4876,
      currency: "gbp",
      volume: 700,
      url: "https://www.edradour.com/ballechin-10-year-old",
      bottleId: bottle.id,
    });
    await fixtures.StorePrice({
      externalSiteId: site.id,
      name: "Edradour Cask Strength 21-year-old Oloroso Sherry",
      price: 37500,
      currency: "gbp",
      volume: 700,
      url: "https://www.edradour.com/Cask-Strength-21-y.o.-Oloroso-Sherry",
      bottleId: null,
      hidden: true,
    });
    const prices = await db.select().from(storePrices);
    const histories = await db.select().from(storePriceHistories);
    const runs = await db.select().from(externalSiteRuns);
    const [target] = await db.select().from(scrapeTargets);

    await expect(prepareEdradour()).resolves.toEqual({
      siteId: site.id,
      scrapeSourceId: null,
      priceCount: 2,
      visiblePriceCount: 1,
      matchedPriceCount: 1,
      applied: false,
    });
    expect(await db.select().from(scrapeSources)).toEqual([]);
    expect(await db.select().from(storePrices)).toEqual(prices);

    const applied = await prepareEdradour({ apply: true });
    expect(applied).toEqual({
      siteId: site.id,
      scrapeSourceId: expect.any(Number),
      priceCount: 2,
      visiblePriceCount: 1,
      matchedPriceCount: 1,
      applied: true,
    });
    await syncScraperDefinitions(edradourRegistry);
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
        listUrl: "https://www.edradour.com/shop/",
        enabled: false,
        createdById: admin.id,
      }),
    ]);
    await expect(prepareEdradour({ apply: true })).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Edradour is already prepared for saved scraping rules.",
    });
  });

  test("refuses an unexpected Edradour price without changing records", async ({
    fixtures,
  }) => {
    const site = await setupEdradourMigration();
    await fixtures.StorePrice({
      externalSiteId: site.id,
      name: "Edradour Cask Strength 21-year-old Oloroso Sherry",
      currency: "gbp",
      volume: 700,
      url: "https://example.com/Cask-Strength-21-y.o.-Oloroso-Sherry",
      bottleId: null,
    });
    const prices = await db.select().from(storePrices);
    const targets = await db.select().from(scrapeTargets);

    await expect(prepareEdradour({ apply: true })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("Check Edradour price"),
    });
    expect(await db.select().from(storePrices)).toEqual(prices);
    expect(await db.select().from(scrapeTargets)).toEqual(targets);
    expect(await db.select().from(scrapeSources)).toEqual([]);
  });

  test("prepares Thompson Bros. without replacing prices or Bottle matches", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const site = await setupThompsonBrosMigration();
    await fixtures.StorePrice({
      externalSiteId: site.id,
      externalProductId: "108879",
      name: "Thompson Bros Glen Scotia Single Malt Scotch Whisky, 2013, 12-year-old, 70CL, 56.7%ABV",
      price: 5833,
      currency: "gbp",
      volume: 700,
      url: "https://www.thompsonbrosdistillers.com/product/glen-scotia-single-malt-scotch-whisky-2013-12-year-old/",
      bottleId: bottle.id,
    });
    await fixtures.StorePrice({
      externalSiteId: site.id,
      externalProductId: null,
      name: "Thompson Bros Highland Single Malt Scotch Whisky, 18-year-old, 70CL, 48.5% ABV",
      price: 5417,
      currency: "gbp",
      volume: 700,
      url: "https://www.thompsonbrosdistillers.com/product/Highland18yo/",
      bottleId: null,
      hidden: true,
    });
    const prices = await db.select().from(storePrices);
    const histories = await db.select().from(storePriceHistories);
    const runs = await db.select().from(externalSiteRuns);
    const [target] = await db.select().from(scrapeTargets);

    await expect(prepareThompsonBros()).resolves.toEqual({
      siteId: site.id,
      scrapeSourceId: null,
      priceCount: 2,
      visiblePriceCount: 1,
      matchedPriceCount: 1,
      applied: false,
    });
    expect(await db.select().from(scrapeSources)).toEqual([]);
    expect(await db.select().from(storePrices)).toEqual(prices);

    const applied = await prepareThompsonBros({ apply: true });
    expect(applied).toEqual({
      siteId: site.id,
      scrapeSourceId: expect.any(Number),
      priceCount: 2,
      visiblePriceCount: 1,
      matchedPriceCount: 1,
      applied: true,
    });
    await syncScraperDefinitions(thompsonBrosRegistry);
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
        listUrl:
          "https://www.thompsonbrosdistillers.com/product-category/whisky/",
        enabled: false,
        createdById: admin.id,
      }),
    ]);
    await expect(prepareThompsonBros({ apply: true })).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Thompson Bros. is already prepared for saved scraping rules.",
    });
  });

  test("refuses an unexpected Thompson Bros. price without changing records", async ({
    fixtures,
  }) => {
    const site = await setupThompsonBrosMigration();
    await fixtures.StorePrice({
      externalSiteId: site.id,
      externalProductId: "108879",
      name: "Thompson Bros Glen Scotia Single Malt Scotch Whisky",
      currency: "gbp",
      volume: 700,
      url: "https://example.com/product/glen-scotia/",
      bottleId: null,
    });
    const prices = await db.select().from(storePrices);
    const targets = await db.select().from(scrapeTargets);

    await expect(prepareThompsonBros({ apply: true })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("Check Thompson Bros. price"),
    });
    expect(await db.select().from(storePrices)).toEqual(prices);
    expect(await db.select().from(scrapeTargets)).toEqual(targets);
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

  test("prepares Cadenhead's without replacing prices or Bottle matches", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const site = await setupCadenheadsMigration();
    await fixtures.StorePrice({
      externalSiteId: site.id,
      externalProductId: "5996",
      name: "Cadenhead's 7-Stars Blend 46%",
      price: 4000,
      currency: "gbp",
      volume: 700,
      url: "https://www.cadenhead.shop/product/cadenheads-7-stars-blend-46/",
      bottleId: bottle.id,
    });
    await fixtures.StorePrice({
      externalSiteId: site.id,
      externalProductId: null,
      name: "Older Cadenhead's release",
      price: 6500,
      currency: "gbp",
      volume: 700,
      url: "https://www.cadenhead.shop/product/older-cadenheads-release/",
      bottleId: null,
      hidden: true,
    });
    const prices = await db.select().from(storePrices);
    const histories = await db.select().from(storePriceHistories);
    const runs = await db.select().from(externalSiteRuns);
    const [target] = await db.select().from(scrapeTargets);

    await expect(prepareCadenheads()).resolves.toEqual({
      siteId: site.id,
      scrapeSourceId: null,
      priceCount: 2,
      visiblePriceCount: 1,
      matchedPriceCount: 1,
      applied: false,
    });
    expect(await db.select().from(scrapeSources)).toEqual([]);
    expect(await db.select().from(storePrices)).toEqual(prices);

    const applied = await prepareCadenheads({ apply: true });
    expect(applied).toEqual({
      siteId: site.id,
      scrapeSourceId: expect.any(Number),
      priceCount: 2,
      visiblePriceCount: 1,
      matchedPriceCount: 1,
      applied: true,
    });
    await syncScraperDefinitions(cadenheadsRegistry);
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
        listUrl: "https://www.cadenhead.shop/product-category/whisky/",
        enabled: false,
        createdById: admin.id,
      }),
    ]);
  });

  test("refuses an unexpected Cadenhead's price", async ({ fixtures }) => {
    const site = await setupCadenheadsMigration();
    await fixtures.StorePrice({
      externalSiteId: site.id,
      externalProductId: "not-a-number",
      name: "Unknown release",
      currency: "gbp",
      volume: 700,
      url: "https://www.cadenhead.shop/product/unknown-release/",
      bottleId: null,
    });
    const prices = await db.select().from(storePrices);

    await expect(prepareCadenheads({ apply: true })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("Check Cadenhead's price"),
    });
    expect(await db.select().from(storePrices)).toEqual(prices);
    expect(await db.select().from(scrapeSources)).toEqual([]);
  });

  test("prepares Bruichladdich without replacing prices or Bottle matches", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const site = await setupBruichladdichMigration();
    await fixtures.StorePrice({
      externalSiteId: site.id,
      externalProductId: "8468808368301",
      name: "Bruichladdich The Classic Laddie 10 Aged Years",
      price: 4600,
      currency: "gbp",
      volume: 700,
      url: "https://www.bruichladdich.com/products/bruichladdich-the-classic-laddie",
      bottleId: bottle.id,
    });
    await fixtures.StorePrice({
      externalSiteId: site.id,
      externalProductId: "7420351381677",
      name: "Bruichladdich Black Art Edition 11",
      price: 39500,
      currency: "gbp",
      volume: 700,
      url: "https://www.bruichladdich.com/products/bruichladdich-black-art-edition-11",
      bottleId: null,
      hidden: true,
    });
    const prices = await db.select().from(storePrices);
    const histories = await db.select().from(storePriceHistories);
    const runs = await db.select().from(externalSiteRuns);
    const [target] = await db.select().from(scrapeTargets);

    await expect(prepareBruichladdich()).resolves.toEqual({
      siteId: site.id,
      scrapeSourceId: null,
      priceCount: 2,
      visiblePriceCount: 1,
      matchedPriceCount: 1,
      applied: false,
    });
    expect(await db.select().from(scrapeSources)).toEqual([]);
    expect(await db.select().from(storePrices)).toEqual(prices);

    const applied = await prepareBruichladdich({ apply: true });
    expect(applied).toEqual({
      siteId: site.id,
      scrapeSourceId: expect.any(Number),
      priceCount: 2,
      visiblePriceCount: 1,
      matchedPriceCount: 1,
      applied: true,
    });
    await syncScraperDefinitions(bruichladdichRegistry);
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
        listUrl:
          "https://www.bruichladdich.com/collections/all?filter.v.availability=1",
        enabled: false,
        createdById: admin.id,
      }),
    ]);
  });

  test("refuses an unexpected Bruichladdich price", async ({ fixtures }) => {
    const site = await setupBruichladdichMigration();
    await fixtures.StorePrice({
      externalSiteId: site.id,
      externalProductId: "not-a-number",
      name: "Unknown release",
      currency: "gbp",
      volume: 700,
      url: "https://www.bruichladdich.com/products/unknown-release",
      bottleId: null,
    });
    const prices = await db.select().from(storePrices);

    await expect(prepareBruichladdich({ apply: true })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("Check Bruichladdich price"),
    });
    expect(await db.select().from(storePrices)).toEqual(prices);
    expect(await db.select().from(scrapeSources)).toEqual([]);
  });

  test("prepares Gordon & MacPhail without replacing prices or Bottle matches", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const site = await setupGordonMacphailMigration();
    await fixtures.StorePrice({
      externalSiteId: site.id,
      externalProductId: "15278344929666",
      name: "CC CASK STRENGTH GLENTURRET 2007 59.8% - 70cl",
      price: 16000,
      currency: "gbp",
      volume: 700,
      url: "https://shop.gordonandmacphail.com/products/cc-cask-strength-glenturret-2007-59-8-70cl",
      bottleId: bottle.id,
    });
    await fixtures.StorePrice({
      externalSiteId: site.id,
      externalProductId: "6631010533443",
      name: "Distillery Labels Linkwood 15-year-old 46%",
      price: 8999,
      currency: "gbp",
      volume: 700,
      url: "https://shop.gordonandmacphail.com/products/distillery-labels-linkwood-15-years-old-46",
      bottleId: null,
      hidden: true,
    });
    const prices = await db.select().from(storePrices);
    const histories = await db.select().from(storePriceHistories);
    const runs = await db.select().from(externalSiteRuns);
    const [target] = await db.select().from(scrapeTargets);

    await expect(prepareGordonMacphail()).resolves.toEqual({
      siteId: site.id,
      scrapeSourceId: null,
      priceCount: 2,
      visiblePriceCount: 1,
      matchedPriceCount: 1,
      applied: false,
    });
    expect(await db.select().from(scrapeSources)).toEqual([]);
    expect(await db.select().from(storePrices)).toEqual(prices);

    const applied = await prepareGordonMacphail({ apply: true });
    expect(applied).toEqual({
      siteId: site.id,
      scrapeSourceId: expect.any(Number),
      priceCount: 2,
      visiblePriceCount: 1,
      matchedPriceCount: 1,
      applied: true,
    });
    await syncScraperDefinitions(gordonMacphailRegistry);
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
        listUrl: "https://shop.gordonandmacphail.com/collections/all",
        enabled: false,
        createdById: admin.id,
      }),
    ]);
  });

  test("refuses an unexpected Gordon & MacPhail price", async ({
    fixtures,
  }) => {
    const site = await setupGordonMacphailMigration();
    await fixtures.StorePrice({
      externalSiteId: site.id,
      externalProductId: null,
      name: "Unknown product",
      currency: "gbp",
      volume: 700,
      url: "https://shop.gordonandmacphail.com/products/unknown-product",
      bottleId: null,
    });
    const prices = await db.select().from(storePrices);

    await expect(prepareGordonMacphail({ apply: true })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("Check Gordon & MacPhail price"),
    });
    expect(await db.select().from(storePrices)).toEqual(prices);
    expect(await db.select().from(scrapeSources)).toEqual([]);
  });

  test("prepares GlenAllachie without replacing prices or Bottle matches", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const site = await setupGlenAllachieMigration();
    await fixtures.StorePrice({
      externalSiteId: site.id,
      externalProductId: "9187573072212",
      name: "The GlenAllachie 12-year-old",
      price: 5699,
      currency: "gbp",
      volume: 700,
      url: "https://shop.theglenallachie.com/products/glenallachie-12-year-old",
      bottleId: bottle.id,
    });
    await fixtures.StorePrice({
      externalSiteId: site.id,
      externalProductId: "9187894034772",
      name: "White Heather 15-year-old",
      price: 6999,
      currency: "gbp",
      volume: 700,
      url: "https://shop.theglenallachie.com/products/white-heather-15-year-old",
      bottleId: null,
      hidden: true,
    });
    const prices = await db.select().from(storePrices);
    const histories = await db.select().from(storePriceHistories);
    const runs = await db.select().from(externalSiteRuns);
    const [target] = await db.select().from(scrapeTargets);

    await expect(prepareGlenAllachie()).resolves.toEqual({
      siteId: site.id,
      scrapeSourceId: null,
      priceCount: 2,
      visiblePriceCount: 1,
      matchedPriceCount: 1,
      applied: false,
    });
    expect(await db.select().from(scrapeSources)).toEqual([]);
    expect(await db.select().from(storePrices)).toEqual(prices);

    const applied = await prepareGlenAllachie({ apply: true });
    expect(applied).toEqual({
      siteId: site.id,
      scrapeSourceId: expect.any(Number),
      priceCount: 2,
      visiblePriceCount: 1,
      matchedPriceCount: 1,
      applied: true,
    });
    await syncScraperDefinitions(glenAllachieRegistry);
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
        listUrl: "https://shop.theglenallachie.com/collections/all-products",
        enabled: false,
        createdById: admin.id,
      }),
    ]);
    await expect(prepareGlenAllachie({ apply: true })).rejects.toMatchObject({
      code: "CONFLICT",
      message: "GlenAllachie is already prepared for saved scraping rules.",
    });
  });

  test("refuses an unexpected GlenAllachie price without changing records", async ({
    fixtures,
  }) => {
    const site = await setupGlenAllachieMigration();
    await fixtures.StorePrice({
      externalSiteId: site.id,
      externalProductId: "not-a-number",
      name: "Unknown product",
      currency: "gbp",
      volume: 700,
      url: "https://shop.theglenallachie.com/products/unknown-product",
      bottleId: null,
    });
    const prices = await db.select().from(storePrices);
    const targets = await db.select().from(scrapeTargets);

    await expect(prepareGlenAllachie({ apply: true })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("Check GlenAllachie price"),
    });
    expect(await db.select().from(storePrices)).toEqual(prices);
    expect(await db.select().from(scrapeTargets)).toEqual(targets);
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

  test("prepares North Star without replacing prices or Bottle matches", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const site = await setupNorthStarMigration();
    await fixtures.StorePrice({
      externalSiteId: site.id,
      externalProductId: "11471377727829",
      name: "The Speyside Connection",
      price: 6999,
      currency: "gbp",
      volume: 700,
      url: "https://northstarspirits.com/products/speyside-connection",
      bottleId: bottle.id,
    });
    await fixtures.StorePrice({
      externalSiteId: site.id,
      externalProductId: "9887521767765",
      name: "Caol Ila Sherry Octave",
      price: 5700,
      currency: "gbp",
      volume: 500,
      url: "https://northstarspirits.com/products/caol-ila-sherry-octave",
      bottleId: null,
      hidden: true,
    });
    const prices = await db.select().from(storePrices);
    const histories = await db.select().from(storePriceHistories);
    const runs = await db.select().from(externalSiteRuns);
    const [target] = await db.select().from(scrapeTargets);

    await expect(prepareNorthStar()).resolves.toEqual({
      siteId: site.id,
      scrapeSourceId: null,
      priceCount: 2,
      visiblePriceCount: 1,
      matchedPriceCount: 1,
      applied: false,
    });
    expect(await db.select().from(scrapeSources)).toEqual([]);
    expect(await db.select().from(storePrices)).toEqual(prices);

    const applied = await prepareNorthStar({ apply: true });
    expect(applied).toEqual({
      siteId: site.id,
      scrapeSourceId: expect.any(Number),
      priceCount: 2,
      visiblePriceCount: 1,
      matchedPriceCount: 1,
      applied: true,
    });
    await syncScraperDefinitions(northStarRegistry);
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
        listUrl: "https://northstarspirits.com/collections/shop",
        enabled: false,
        createdById: admin.id,
      }),
    ]);
    await expect(prepareNorthStar({ apply: true })).rejects.toMatchObject({
      code: "CONFLICT",
      message: "North Star is already prepared for saved scraping rules.",
    });
  });

  test("refuses an unexpected North Star price without changing records", async ({
    fixtures,
  }) => {
    const site = await setupNorthStarMigration();
    await fixtures.StorePrice({
      externalSiteId: site.id,
      externalProductId: "not-a-number",
      name: "Unknown release",
      currency: "gbp",
      volume: 700,
      url: "https://northstarspirits.com/products/unknown-release",
      bottleId: null,
    });
    const prices = await db.select().from(storePrices);
    const targets = await db.select().from(scrapeTargets);

    await expect(prepareNorthStar({ apply: true })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("Check North Star price"),
    });
    expect(await db.select().from(storePrices)).toEqual(prices);
    expect(await db.select().from(scrapeTargets)).toEqual(targets);
    expect(await db.select().from(scrapeSources)).toEqual([]);
  });

  test("prepares Nc'nean without replacing current or historical prices", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const site = await setupNcneanMigration();
    await fixtures.StorePrice({
      externalSiteId: site.id,
      externalProductId: "15761596776830",
      name: "Nc'nean Aon 17-163 Madeira Cask (Single Cask)",
      price: 9495,
      currency: "gbp",
      volume: 700,
      url: "https://ncnean.com/products/aon-17-163-madeira-single-cask",
      bottleId: bottle.id,
    });
    await fixtures.StorePrice({
      externalSiteId: site.id,
      externalProductId: null,
      name: "Nc'nean Quiet Rebels: Amy (Limited Edition)",
      price: 7995,
      currency: "gbp",
      volume: 700,
      url: "https://ncnean.com/products/quiet-rebels-amy",
      bottleId: null,
      hidden: true,
    });
    const prices = await db.select().from(storePrices);
    const histories = await db.select().from(storePriceHistories);
    const runs = await db.select().from(externalSiteRuns);
    const [target] = await db.select().from(scrapeTargets);

    await expect(prepareNcnean()).resolves.toEqual({
      siteId: site.id,
      scrapeSourceId: null,
      priceCount: 2,
      visiblePriceCount: 1,
      matchedPriceCount: 1,
      applied: false,
    });
    expect(await db.select().from(scrapeSources)).toEqual([]);
    expect(await db.select().from(storePrices)).toEqual(prices);

    const applied = await prepareNcnean({ apply: true });
    expect(applied).toEqual({
      siteId: site.id,
      scrapeSourceId: expect.any(Number),
      priceCount: 2,
      visiblePriceCount: 1,
      matchedPriceCount: 1,
      applied: true,
    });
    await syncScraperDefinitions(ncneanRegistry);
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
        listUrl: "https://ncnean.com/collections/all/whiskies",
        enabled: false,
        createdById: admin.id,
      }),
    ]);
    await expect(prepareNcnean({ apply: true })).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Nc'nean is already prepared for saved scraping rules.",
    });
  });

  test("refuses an unexpected Nc'nean price without changing records", async ({
    fixtures,
  }) => {
    const site = await setupNcneanMigration();
    await fixtures.StorePrice({
      externalSiteId: site.id,
      externalProductId: "not-a-number",
      name: "Nc'nean Unknown release",
      currency: "gbp",
      volume: 700,
      url: "https://ncnean.com/products/unknown-release",
      bottleId: null,
    });
    const prices = await db.select().from(storePrices);
    const targets = await db.select().from(scrapeTargets);

    await expect(prepareNcnean({ apply: true })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("Check Nc'nean price"),
    });
    expect(await db.select().from(storePrices)).toEqual(prices);
    expect(await db.select().from(scrapeTargets)).toEqual(targets);
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
          document: "html",
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
                match: null,
                addStart: null,
                addEnd: null,
              },
            ],
          },
          publishedDate: {
            try: [
              {
                get: "attribute",
                selector: "time",
                attribute: "datetime",
                match: null,
                addStart: null,
                addEnd: null,
              },
            ],
          },
          reviews: {
            inside: "body",
            oneReviewPer: "element",
            selector: ".entry-content",
            contains: null,
            name: {
              try: [
                {
                  get: "text",
                  from: "review",
                  selector: "h2.name",
                  take: "first",
                  match: null,
                  addStart: null,
                  addEnd: null,
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
                  match: null,
                  addStart: null,
                  addEnd: null,
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
                  match: null,
                  addStart: null,
                  addEnd: null,
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
    const completeRun = async (runId: number, executionToken: string) => {
      let execution = 1;
      while (true) {
        const result = await executeScraperRun(
          { runId },
          {
            registry,
            fetchImpl,
            clock,
            executionToken: `${executionToken}-${execution}`,
          },
        );
        if (result.status === "completed") return result;
        if (result.status !== "waiting") {
          throw new Error("The saved scraper is already running.");
        }
        now = result.nextAttemptAt;
        execution += 1;
      }
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
        completeRun(run.id, `migration-${attempt}`),
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
