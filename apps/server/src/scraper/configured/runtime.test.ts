import { db } from "@peated/server/db";
import {
  bottleGroups,
  bottleObservations,
  bottleReferences,
  bottleSeries,
  bottles,
  catalogListings,
  externalReviewArticles,
  externalReviewBodies,
  externalReviews,
  externalSiteRuns,
  scrapeOrigins,
  scrapeSourceRevisions,
  scrapeSourceRuns,
  scrapeTargets,
  storePrices,
  users,
} from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import { vi } from "vitest";
import { createScraperRegistry } from "../definitions";
import type { ScraperHttpClock } from "../http";
import { executeScraperRun } from "../runs";
import type { ScrapeRules } from "./rules";
import {
  createPinnedScrapeSourceRun,
  createScrapeSourceSuggestionRun,
} from "./runs";
import {
  activateScrapeSourceRevision,
  createScrapeSourceRevision,
  createSiteWithScrapeSource,
  recordScrapeSourcePreview,
} from "./service";

type TestClock = ScraperHttpClock & { advanceTo(value: Date): void };

function fixedClock(): TestClock {
  let now = new Date("2026-08-28T12:00:00Z");
  return {
    now: () => now,
    sleep: async (milliseconds) => {
      now = new Date(now.getTime() + milliseconds);
    },
    random: () => 0,
    advanceTo: (value: Date) => {
      now = value;
    },
  };
}

async function runToCompletion({
  runId,
  fetchImpl,
  clock = fixedClock(),
  executionToken,
}: {
  runId: number;
  fetchImpl: typeof fetch;
  clock?: TestClock;
  executionToken: string;
}) {
  const registry = createScraperRegistry({ targets: [], sources: [] });
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    const result = await executeScraperRun(
      { runId },
      {
        registry,
        fetchImpl,
        clock,
        executionToken: `${executionToken}-${attempt}`,
      },
    );
    if (result.status === "completed") return result;
    if (result.status !== "waiting") {
      throw new Error("The test run is already owned by another execution.");
    }
    clock.advanceTo(result.nextAttemptAt);
  }
  throw new Error("The test run did not finish within 20 executions.");
}

function reviewRules(titleSelector = "h1", paginate = false) {
  return {
    kind: "review",
    articles: {
      document: "html",
      oneArticlePer: "body",
      link: "a.review",
      skipWhen: null,
      nextPage: paginate ? "a.next" : null,
      limit: 5,
    },
    article: {
      canonicalUrl: null,
      title: {
        try: [
          {
            get: "text",
            selector: titleSelector,
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
        selector: "article.review",
        contains: null,
        name: {
          try: [
            {
              get: "text",
              from: "review",
              selector: "h2",
              take: "first",
              match: null,
              addStart: null,
              addEnd: null,
            },
          ],
        },
        reviewer: null,
        tastingNotes: {
          try: [
            {
              get: "text",
              from: "review",
              selector: ".body",
              take: "first",
              match: null,
              addStart: null,
              addEnd: null,
            },
          ],
        },
        score: null,
      },
    },
  } as const satisfies ScrapeRules;
}

function catalogRules() {
  const field = (selector: string, attribute?: string) => ({
    try: [
      attribute
        ? {
            get: "attribute" as const,
            selector,
            attribute,
            match: null,
            addStart: null,
            addEnd: null,
          }
        : {
            get: "text" as const,
            selector,
            take: "first" as const,
            match: null,
            addStart: null,
            addEnd: null,
          },
    ],
  });
  return {
    kind: "catalog",
    products: {
      oneProductPer: "article.product",
      link: "a[href]",
      skipWhen: null,
      nextPage: null,
      limit: 5,
    },
    product: {
      name: field("h1"),
      url: null,
      externalProductId: field("[data-product-id]", "data-product-id"),
      imageUrl: null,
      volume: field(".volume"),
      abv: field(".abv"),
      statedAge: null,
      edition: null,
      releaseYear: null,
    },
  } as const satisfies ScrapeRules;
}

async function setupCatalogSource() {
  const [user] = await db
    .insert(users)
    .values({
      username: "catalog-admin",
      email: "catalog-admin@example.com",
      admin: true,
    })
    .returning();
  if (!user) throw new Error("Failed to create user.");
  const { site, source } = await createSiteWithScrapeSource({
    name: "Official Catalog",
    kind: "catalog",
    websiteUrl: "https://catalog.example/whisky",
    createdById: user.id,
  });
  const revision = await createScrapeSourceRevision({
    scrapeSourceId: source.id,
    author: "person",
    createdById: user.id,
    rules: catalogRules(),
  });
  await db
    .update(scrapeOrigins)
    .set({
      robotsMode: "not_applicable",
      robotsRationale: "Reserved test origin has no network operator.",
    })
    .where(eq(scrapeOrigins.origin, "https://catalog.example"));
  return { revision, site, source, user };
}

function catalogFetch(name = "Official Release") {
  return vi.fn<typeof fetch>(async (input) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.pathname === "/whisky") {
      return new Response(
        '<article class="product"><a href="/whisky/release">Release</a></article>',
      );
    }
    if (url.pathname === "/whisky/release") {
      return new Response(
        `<main data-product-id="official-1"><h1>${name}</h1><span class="volume">70 cl</span><span class="abv">46% ABV</span><p class="description">Publisher prose.</p></main>`,
      );
    }
    throw new Error(`Unexpected URL: ${url.toString()}`);
  });
}

function catalogProductsFetch(
  products: Array<{ id: string; name: string; slug: string }>,
) {
  return vi.fn<typeof fetch>(async (input) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.pathname === "/whisky") {
      return new Response(
        products
          .map(
            ({ name, slug }) =>
              `<article class="product"><a href="/whisky/${slug}">${name}</a></article>`,
          )
          .join(""),
      );
    }
    const product = products.find(
      ({ slug }) => url.pathname === `/whisky/${slug}`,
    );
    if (product) {
      return new Response(
        `<main data-product-id="${product.id}"><h1>${product.name}</h1><span class="volume">70 cl</span><span class="abv">46% ABV</span></main>`,
      );
    }
    throw new Error(`Unexpected URL: ${url.toString()}`);
  });
}

async function setupSource(titleSelector = "h1", paginate = false) {
  const [user] = await db
    .insert(users)
    .values({ username: "admin", email: "admin@example.com", admin: true })
    .returning();
  if (!user) throw new Error("Failed to create user.");
  const { site, source } = await createSiteWithScrapeSource({
    name: "Preview Reviews",
    kind: "review",
    websiteUrl: "https://preview.example/archive",
    createdById: user.id,
  });
  const revision = await createScrapeSourceRevision({
    scrapeSourceId: source.id,
    author: "person",
    createdById: user.id,
    rules: reviewRules(titleSelector, paginate),
  });
  await db
    .update(scrapeOrigins)
    .set({
      robotsMode: "not_applicable",
      robotsRationale: "Reserved test origin has no network operator.",
    })
    .where(eq(scrapeOrigins.origin, "https://preview.example"));
  return { revision, site, source, user };
}

async function setupPreview(titleSelector = "h1", paginate = false) {
  const created = await setupSource(titleSelector, paginate);
  const pinned = await createPinnedScrapeSourceRun(db, {
    externalSiteId: created.site.id,
    scrapeSourceId: created.source.id,
    revisionId: created.revision.id,
    requestedById: created.user.id,
    trigger: "manual",
    purpose: "preview",
  });
  return { ...created, pinned };
}

function previewFetch(paginate = false) {
  return vi.fn<typeof fetch>(async (input) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.pathname === "/archive") {
      return new Response(
        url.searchParams.get("page") === "2"
          ? '<a class="review" href="/two">Two</a>'
          : `<a class="review" href="/one">One</a>${paginate ? '<a class="next" href="/archive?page=2">Next</a>' : ""}`,
      );
    }
    if (url.pathname === "/one") {
      return new Response(
        '<h1>August reviews</h1><time datetime="2026-08-12"></time><article class="review"><h2>Example Whisky</h2><div class="body">Publisher prose must not be stored in preview.</div></article>',
      );
    }
    if (url.pathname === "/two") {
      return new Response(
        '<h1>Earlier reviews</h1><time datetime="2026-07-30"></time><article class="review"><h2>Second Whisky</h2><div class="body">Another review.</div></article>',
      );
    }
    throw new Error(`Unexpected URL: ${url.toString()}`);
  });
}

test("runs preview through the normal request controls without product writes", async () => {
  const { pinned, revision } = await setupPreview();
  await expect(
    runToCompletion({
      runId: pinned.run.id,
      fetchImpl: previewFetch(),
      executionToken: "preview-owner",
    }),
  ).resolves.toEqual({ status: "completed" });

  const [storedRevision] = await db
    .select()
    .from(scrapeSourceRevisions)
    .where(eq(scrapeSourceRevisions.id, revision.id));
  expect(storedRevision).toMatchObject({ previewStatus: "passed" });
  expect(JSON.stringify(storedRevision?.previewResult)).not.toContain(
    "Publisher prose",
  );
  expect(await db.select().from(externalReviewArticles)).toHaveLength(0);
  expect(await db.select().from(externalReviewBodies)).toHaveLength(0);
  const [run] = await db
    .select()
    .from(externalSiteRuns)
    .where(eq(externalSiteRuns.id, pinned.run.id));
  expect(run).toMatchObject({ status: "succeeded", emittedItemCount: 0 });
});

test("previews an official catalog without writing listings", async () => {
  const { revision, site, source, user } = await setupCatalogSource();
  const pinned = await createPinnedScrapeSourceRun(db, {
    externalSiteId: site.id,
    scrapeSourceId: source.id,
    revisionId: revision.id,
    requestedById: user.id,
    trigger: "manual",
    purpose: "preview",
  });

  await expect(
    runToCompletion({
      runId: pinned.run.id,
      fetchImpl: catalogFetch(),
      executionToken: "catalog-preview-owner",
    }),
  ).resolves.toEqual({ status: "completed" });

  const [storedRevision] = await db
    .select()
    .from(scrapeSourceRevisions)
    .where(eq(scrapeSourceRevisions.id, revision.id));
  expect(storedRevision?.previewResult).toMatchObject({
    issues: [],
    pages: [
      {
        kind: "catalog",
        products: [
          {
            externalProductId: "official-1",
            name: "Official Release",
            volume: 700,
          },
        ],
      },
    ],
  });
  expect(JSON.stringify(storedRevision?.previewResult)).not.toContain(
    "Publisher prose",
  );
  expect(await db.select().from(catalogListings)).toHaveLength(0);
  expect(await db.select().from(bottles)).toHaveLength(0);
  expect(await db.select().from(bottleGroups)).toHaveLength(0);
  expect(await db.select().from(bottleSeries)).toHaveLength(0);
  expect(await db.select().from(bottleReferences)).toHaveLength(0);
  expect(await db.select().from(bottleObservations)).toHaveLength(0);
  expect(await db.select().from(externalReviewArticles)).toHaveLength(0);
  expect(await db.select().from(externalReviews)).toHaveLength(0);
  expect(await db.select().from(externalReviewBodies)).toHaveLength(0);
  expect(await db.select().from(storePrices)).toHaveLength(0);
});

test("collects and updates only catalog listings", async () => {
  const { revision, site, source, user } = await setupCatalogSource();
  await recordScrapeSourcePreview({
    revisionId: revision.id,
    status: "passed",
    result: { issues: [], pages: [] },
  });
  await activateScrapeSourceRevision({
    scrapeSourceId: source.id,
    revisionId: revision.id,
  });

  for (const [index, name] of [
    "Official Release",
    "Updated Official Release",
  ].entries()) {
    const pinned = await createPinnedScrapeSourceRun(db, {
      externalSiteId: site.id,
      requestedById: user.id,
      trigger: "manual",
      purpose: "collect",
    });
    await expect(
      runToCompletion({
        runId: pinned.run.id,
        fetchImpl: catalogFetch(name),
        executionToken: `catalog-collection-owner-${index}`,
      }),
    ).resolves.toEqual({ status: "completed" });
  }

  const collectedListings = await db.select().from(catalogListings);
  expect(collectedListings).toMatchObject([
    {
      externalSiteId: site.id,
      externalProductId: "official-1",
      name: "Updated Official Release",
      volume: 700,
    },
  ]);
  expect(JSON.stringify(collectedListings)).not.toContain("Publisher prose");
  expect(await db.select().from(bottles)).toHaveLength(0);
  expect(await db.select().from(bottleGroups)).toHaveLength(0);
  expect(await db.select().from(bottleSeries)).toHaveLength(0);
  expect(await db.select().from(bottleReferences)).toHaveLength(0);
  expect(await db.select().from(bottleObservations)).toHaveLength(0);
  expect(await db.select().from(externalReviewArticles)).toHaveLength(0);
  expect(await db.select().from(externalReviews)).toHaveLength(0);
  expect(await db.select().from(externalReviewBodies)).toHaveLength(0);
  expect(await db.select().from(storePrices)).toHaveLength(0);
});

test("keeps a catalog product that is absent from a later run", async () => {
  const { revision, site, source, user } = await setupCatalogSource();
  await recordScrapeSourcePreview({
    revisionId: revision.id,
    status: "passed",
    result: { issues: [], pages: [] },
  });
  await activateScrapeSourceRevision({
    scrapeSourceId: source.id,
    revisionId: revision.id,
  });

  const runCatalog = async (
    products: Array<{ id: string; name: string; slug: string }>,
    executionToken: string,
  ) => {
    const pinned = await createPinnedScrapeSourceRun(db, {
      externalSiteId: site.id,
      requestedById: user.id,
      trigger: "manual",
      purpose: "collect",
    });
    await runToCompletion({
      runId: pinned.run.id,
      fetchImpl: catalogProductsFetch(products),
      executionToken,
    });
  };

  const firstProducts = [
    { id: "official-1", name: "Current Release", slug: "current" },
    { id: "official-2", name: "Older Release", slug: "older" },
  ];
  await runCatalog(firstProducts, "catalog-full-run");
  const [olderBefore] = await db
    .select()
    .from(catalogListings)
    .where(eq(catalogListings.externalProductId, "official-2"));
  if (!olderBefore) throw new Error("Older catalog product was not collected.");

  await runCatalog([firstProducts[0]!], "catalog-later-run");
  const listings = await db
    .select()
    .from(catalogListings)
    .where(eq(catalogListings.externalSiteId, site.id));
  const olderAfter = listings.find(
    ({ externalProductId }) => externalProductId === "official-2",
  );

  expect(listings).toHaveLength(2);
  expect(olderAfter?.lastSeenAt).toEqual(olderBefore.lastSeenAt);
});

test("follows a bounded next-page selector", async () => {
  const { pinned, revision } = await setupPreview("h1", true);
  const fetchImpl = previewFetch(true);

  await expect(
    runToCompletion({
      runId: pinned.run.id,
      fetchImpl,
      executionToken: "pagination-owner",
    }),
  ).resolves.toEqual({ status: "completed" });

  const [storedRevision] = await db
    .select()
    .from(scrapeSourceRevisions)
    .where(eq(scrapeSourceRevisions.id, revision.id));
  expect(storedRevision?.previewResult).toMatchObject({
    issues: [],
    pages: [
      { url: "https://preview.example/one" },
      { url: "https://preview.example/two" },
    ],
  });
});

test("resumes configured previews between spaced requests", async () => {
  const { pinned, revision } = await setupPreview("h1", true);
  const fetchImpl = previewFetch(true);
  await expect(
    runToCompletion({
      runId: pinned.run.id,
      fetchImpl,
      executionToken: "preview-owner",
    }),
  ).resolves.toEqual({ status: "completed" });

  const [storedRevision] = await db
    .select()
    .from(scrapeSourceRevisions)
    .where(eq(scrapeSourceRevisions.id, revision.id));
  expect(storedRevision?.previewResult).toMatchObject({
    pages: [
      { url: "https://preview.example/one" },
      { url: "https://preview.example/two" },
    ],
  });
  const requestedPaths = fetchImpl.mock.calls.map(
    ([input]) => new URL(input instanceof Request ? input.url : input).pathname,
  );
  expect(requestedPaths.filter((path) => path === "/archive")).toHaveLength(2);
  expect(requestedPaths.filter((path) => path === "/one")).toHaveLength(1);
  expect(requestedPaths.filter((path) => path === "/two")).toHaveLength(1);
  const [run] = await db
    .select()
    .from(externalSiteRuns)
    .where(eq(externalSiteRuns.id, pinned.run.id));
  expect(run?.attemptCount).toBe(1);
});

test("stores safe validation issues when a selector stops matching", async () => {
  const { pinned, revision } = await setupPreview("h3.missing");
  await expect(
    runToCompletion({
      runId: pinned.run.id,
      fetchImpl: previewFetch(),
      executionToken: "preview-owner",
    }),
  ).rejects.toThrow("The page did not match the saved parsing rules.");

  const [storedRevision] = await db
    .select()
    .from(scrapeSourceRevisions)
    .where(eq(scrapeSourceRevisions.id, revision.id));
  expect(storedRevision).toMatchObject({ previewStatus: "failed" });
  expect(storedRevision?.previewResult).toMatchObject({
    pages: [],
    issues: [expect.objectContaining({ field: "article.title" })],
  });
});

test("a collection failure does not change the preview result", async () => {
  const { revision, site, source, user } = await setupSource("h3.missing");
  await recordScrapeSourcePreview({
    revisionId: revision.id,
    status: "passed",
    result: { issues: [], pages: [] },
  });
  await activateScrapeSourceRevision({
    scrapeSourceId: source.id,
    revisionId: revision.id,
  });
  const pinned = await createPinnedScrapeSourceRun(db, {
    externalSiteId: site.id,
    requestedById: user.id,
    trigger: "manual",
    purpose: "collect",
  });

  await expect(
    runToCompletion({
      runId: pinned.run.id,
      fetchImpl: previewFetch(),
      executionToken: "collection-owner",
    }),
  ).rejects.toThrow("The page did not match the saved parsing rules.");

  const [storedRevision] = await db
    .select()
    .from(scrapeSourceRevisions)
    .where(eq(scrapeSourceRevisions.id, revision.id));
  expect(storedRevision).toMatchObject({
    previewStatus: "passed",
    previewResult: { issues: [], pages: [] },
  });
});

test("a resumed suggestion run reuses its saved revision", async () => {
  const [user] = await db
    .insert(users)
    .values({ username: "suggest-admin", email: "suggest@example.com" })
    .returning();
  if (!user) throw new Error("Failed to create user.");
  const { source } = await createSiteWithScrapeSource({
    name: "Suggest Reviews",
    kind: "review",
    websiteUrl: "https://suggest.example/archive",
    createdById: user.id,
  });
  const run = await createScrapeSourceSuggestionRun({
    scrapeSourceId: source.id,
    requestedById: user.id,
  });
  const revision = await createScrapeSourceRevision({
    scrapeSourceId: source.id,
    author: "ai",
    aiModel: "test-model",
    aiInstructionsVersion: "test-instructions",
    createdById: user.id,
    rules: reviewRules(),
  });
  await db
    .update(scrapeSourceRuns)
    .set({ revisionId: revision.id })
    .where(eq(scrapeSourceRuns.externalSiteRunId, run.id));
  const fetchImpl = vi.fn<typeof fetch>(() => {
    throw new Error("A resumed suggestion must not fetch pages again.");
  });

  await expect(
    executeScraperRun(
      { runId: run.id },
      {
        registry: createScraperRegistry({ targets: [], sources: [] }),
        fetchImpl,
        clock: fixedClock(),
        executionToken: "suggestion-owner",
      },
    ),
  ).resolves.toEqual({ status: "completed" });
  expect(fetchImpl).not.toHaveBeenCalled();
  expect(await db.select().from(scrapeSourceRevisions)).toHaveLength(1);
});
