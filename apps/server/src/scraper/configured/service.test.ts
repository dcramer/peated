import { db } from "@peated/server/db";
import {
  externalReviewArticles,
  externalReviewBodies,
  externalReviews,
  externalSiteRuns,
  externalSites,
  externalSiteScrapeTargets,
  scrapeOrigins,
  scrapeSourceRevisions,
  scrapeSourceRuns,
  scrapeSources,
  scrapeTargets,
  users,
} from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import { ScraperRunTakenOverError } from "../session";
import { reviewSourceKey } from "./reviewSourceKey";
import type { ScrapeRules } from "./rules";
import {
  createPinnedScrapeSourceRun,
  createScrapeSourceSuggestionRun,
} from "./runs";
import {
  activateScrapeSourceRevision,
  createScrapeSourceRevision,
  createSiteKey,
  createSiteWithScrapeSource,
  listScrapeSourceRevisions,
  recordScrapeSourcePreview,
  saveScrapeSourceSuggestion,
  ScrapeSourceChangedError,
  ScrapeSourceConflictError,
  ScrapeSourceValidationError,
} from "./service";

const rules = {
  kind: "review",
  list: {
    links: "a.review",
    nextPage: null,
    limit: 99,
  },
  detail: {
    url: null,
    title: "h1",
    date: "time",
    reviews: {
      area: "body",
      item: "article.review",
      name: "h2",
      reviewer: null,
      tastingNotes: null,
      score: null,
    },
  },
} as const satisfies ScrapeRules;

async function createUser() {
  const [user] = await db
    .insert(users)
    .values({ username: "admin", email: "admin@example.com", admin: true })
    .returning();
  if (!user) throw new Error("Failed to create test user.");
  return user;
}

async function markPreviewPassed(revisionId: number) {
  await db
    .update(scrapeSourceRevisions)
    .set({
      previewStatus: "passed",
      previewResult: { issues: [], pages: [] },
      previewedAt: new Date(),
    })
    .where(eq(scrapeSourceRevisions.id, revisionId));
}

test("creates a site and its admin-owned request rows", async () => {
  const user = await createUser();
  const created = await createSiteWithScrapeSource({
    name: "Example Reviews",
    kind: "review",
    websiteUrl: "https://reviews.example/",
    sampleUrls: ["https://reviews.example/review/one"],
    createdById: user.id,
  });

  expect(created.source).toMatchObject({
    kind: "review",
    enabled: false,
    listUrl: "https://reviews.example/",
  });
  expect(await db.select().from(scrapeTargets)).toEqual([
    expect.objectContaining({
      key: "reviews-example",
      managedBy: "admin",
      enabled: true,
      minimumSpacingMs: 30_000,
    }),
  ]);
  expect(await db.select().from(scrapeOrigins)).toEqual([
    expect.objectContaining({
      origin: "https://reviews.example",
      managedBy: "admin",
      robotsMode: "enforce",
    }),
  ]);
  expect(await db.select().from(externalSiteScrapeTargets)).toEqual([
    expect.objectContaining({
      externalSiteId: created.site.id,
      managedBy: "admin",
    }),
  ]);

  await expect(
    createSiteWithScrapeSource({
      name: "Duplicate",
      kind: "review",
      websiteUrl: "https://reviews.example/other",
      createdById: user.id,
    }),
  ).rejects.toBeInstanceOf(ScrapeSourceConflictError);
});

test("keeps immutable revisions and only activates a passing revision", async () => {
  const user = await createUser();
  const { site, source } = await createSiteWithScrapeSource({
    name: "Versioned Reviews",
    kind: "review",
    websiteUrl: "https://versioned.example/",
    createdById: user.id,
  });
  const first = await createScrapeSourceRevision({
    scrapeSourceId: source.id,
    rules,
    author: "person",
    createdById: user.id,
  });
  await expect(
    activateScrapeSourceRevision({
      scrapeSourceId: source.id,
      revisionId: first.id,
    }),
  ).rejects.toBeInstanceOf(ScrapeSourceValidationError);

  await markPreviewPassed(first.id);
  const activated = await activateScrapeSourceRevision({
    scrapeSourceId: source.id,
    revisionId: first.id,
  });
  expect(activated.source).toMatchObject({
    enabled: true,
  });
  expect(activated.revision).toMatchObject({ id: first.id, active: true });

  const second = await createScrapeSourceRevision({
    scrapeSourceId: source.id,
    listUrl: "https://versioned.example/new-archive",
    rules: {
      ...rules,
      detail: {
        ...rules.detail,
        title: "main h1",
      },
    },
    author: "person",
    createdById: user.id,
  });
  expect(second.revision).toBe(2);
  expect(second.listUrl).toBe("https://versioned.example/new-archive");
  expect(
    (await listScrapeSourceRevisions(source.id)).map((revision) => revision.id),
  ).toEqual([second.id, first.id]);

  const pinned = await createPinnedScrapeSourceRun(db, {
    externalSiteId: site.id,
    requestedById: user.id,
    trigger: "manual",
    purpose: "collect",
  });
  expect(pinned.revision.id).toBe(first.id);
  expect(pinned.run.requestLimit).toBe(104);
  expect(await db.select().from(scrapeSourceRuns)).toEqual([
    expect.objectContaining({
      externalSiteRunId: pinned.run.id,
      scrapeSourceId: source.id,
      revisionId: first.id,
      purpose: "collect",
    }),
  ]);
  await db
    .update(externalSiteRuns)
    .set({ status: "succeeded", completedAt: new Date() })
    .where(eq(externalSiteRuns.id, pinned.run.id));

  await markPreviewPassed(second.id);
  const updated = await activateScrapeSourceRevision({
    scrapeSourceId: source.id,
    revisionId: second.id,
  });
  expect(updated.source.listUrl).toBe("https://versioned.example/new-archive");
});

test("allows AI to update a healthy old rule format", async () => {
  const user = await createUser();
  const { source } = await createSiteWithScrapeSource({
    name: "Old Rules",
    kind: "review",
    websiteUrl: "https://old-rules.example/",
    createdById: user.id,
  });
  const revision = await createScrapeSourceRevision({
    scrapeSourceId: source.id,
    rules,
    author: "person",
    createdById: user.id,
  });
  await markPreviewPassed(revision.id);
  await db
    .update(scrapeSourceRevisions)
    .set({ rulesVersion: 10 })
    .where(eq(scrapeSourceRevisions.id, revision.id));

  await expect(
    createScrapeSourceSuggestionRun({
      scrapeSourceId: source.id,
      requestedById: user.id,
    }),
  ).resolves.toMatchObject({ purpose: "suggest", status: "queued" });
});

test("does not replace a healthy current rule format", async () => {
  const user = await createUser();
  const { source } = await createSiteWithScrapeSource({
    name: "Current Rules",
    kind: "review",
    websiteUrl: "https://current-rules.example/",
    createdById: user.id,
  });
  const revision = await createScrapeSourceRevision({
    scrapeSourceId: source.id,
    rules,
    author: "person",
    createdById: user.id,
  });
  await markPreviewPassed(revision.id);

  await expect(
    createScrapeSourceSuggestionRun({
      scrapeSourceId: source.id,
      requestedById: user.id,
    }),
  ).rejects.toThrow(
    "AI suggestions are available only when the saved rules need updating or the latest preview fails.",
  );
});

test("an old worker cannot overwrite a preview after another worker takes over", async () => {
  const user = await createUser();
  const { site, source } = await createSiteWithScrapeSource({
    name: "Owned Preview",
    kind: "review",
    websiteUrl: "https://owned-preview.example/",
    createdById: user.id,
  });
  const revision = await createScrapeSourceRevision({
    scrapeSourceId: source.id,
    rules,
    author: "person",
    createdById: user.id,
  });
  const pinned = await createPinnedScrapeSourceRun(db, {
    externalSiteId: site.id,
    requestedById: user.id,
    trigger: "manual",
    purpose: "preview",
    revisionId: revision.id,
  });
  await db
    .update(externalSiteRuns)
    .set({
      status: "running",
      executionToken: "new-worker",
      executionExpiresAt: new Date("2026-09-08T13:00:00Z"),
    })
    .where(eq(externalSiteRuns.id, pinned.run.id));

  await expect(
    recordScrapeSourcePreview({
      runId: pinned.run.id,
      executionToken: "old-worker",
      revisionId: revision.id,
      status: "passed",
      result: { issues: [], pages: [] },
    }),
  ).rejects.toBeInstanceOf(ScraperRunTakenOverError);
  const [stored] = await db
    .select()
    .from(scrapeSourceRevisions)
    .where(eq(scrapeSourceRevisions.id, revision.id));
  expect(stored).toMatchObject({
    previewStatus: "pending",
    previewedAt: null,
  });
});

test("an old worker cannot add an AI version after another worker takes over", async () => {
  const user = await createUser();
  const { source } = await createSiteWithScrapeSource({
    name: "Owned Suggestion",
    kind: "review",
    websiteUrl: "https://owned-suggestion.example/",
    createdById: user.id,
  });
  const run = await createScrapeSourceSuggestionRun({
    scrapeSourceId: source.id,
    requestedById: user.id,
  });
  await db
    .update(externalSiteRuns)
    .set({
      status: "running",
      executionToken: "new-worker",
      executionExpiresAt: new Date("2026-09-08T13:00:00Z"),
    })
    .where(eq(externalSiteRuns.id, run.id));
  const input = {
    scrapeSourceId: source.id,
    externalSiteRunId: run.id,
    rules,
    author: "ai" as const,
    createdById: user.id,
    aiModel: "test-model",
    aiInstructionsVersion: "test-instructions",
    previewResult: { issues: [], pages: [] },
  };

  await expect(
    saveScrapeSourceSuggestion({
      ...input,
      executionToken: "old-worker",
    }),
  ).rejects.toBeInstanceOf(ScraperRunTakenOverError);
  expect(await db.select().from(scrapeSourceRevisions)).toEqual([]);

  const revision = await saveScrapeSourceSuggestion({
    ...input,
    executionToken: "new-worker",
  });
  expect(revision).toMatchObject({
    previewStatus: "passed",
    previewResult: { issues: [], pages: [] },
  });
  await expect(
    saveScrapeSourceSuggestion({
      ...input,
      executionToken: "new-worker",
    }),
  ).resolves.toMatchObject({ id: revision.id });
  expect(await db.select().from(scrapeSourceRevisions)).toHaveLength(1);
  expect(await db.select().from(scrapeSourceRuns)).toEqual([
    expect.objectContaining({
      externalSiteRunId: run.id,
      revisionId: revision.id,
    }),
  ]);
});

test("does not activate an automatic repair after the active version changed", async () => {
  const user = await createUser();
  const { source } = await createSiteWithScrapeSource({
    name: "Changed Source",
    kind: "review",
    websiteUrl: "https://changed-source.example/",
    createdById: user.id,
  });
  const first = await createScrapeSourceRevision({
    scrapeSourceId: source.id,
    rules,
    author: "person",
    createdById: user.id,
  });
  await markPreviewPassed(first.id);
  await activateScrapeSourceRevision({
    scrapeSourceId: source.id,
    revisionId: first.id,
  });
  const replacement = await createScrapeSourceRevision({
    scrapeSourceId: source.id,
    rules: { ...rules, detail: { ...rules.detail, title: "article h1" } },
    author: "person",
    createdById: user.id,
  });
  await markPreviewPassed(replacement.id);
  await activateScrapeSourceRevision({
    scrapeSourceId: source.id,
    revisionId: replacement.id,
  });
  const repair = await createScrapeSourceRevision({
    scrapeSourceId: source.id,
    rules: { ...rules, detail: { ...rules.detail, title: "main h1" } },
    author: "ai",
    aiModel: "test-model",
    aiInstructionsVersion: "test-instructions",
  });
  await markPreviewPassed(repair.id);

  await expect(
    activateScrapeSourceRevision({
      scrapeSourceId: source.id,
      revisionId: repair.id,
      expectedActiveRevisionId: first.id,
    }),
  ).rejects.toBeInstanceOf(ScrapeSourceChangedError);
  expect(
    await db
      .select({ id: scrapeSourceRevisions.id })
      .from(scrapeSourceRevisions)
      .where(eq(scrapeSourceRevisions.active, true)),
  ).toEqual([{ id: replacement.id }]);
});

test("keeps the original review and the newer scraped data", async ({
  fixtures,
}) => {
  const user = await createUser();
  const bottle = await fixtures.Bottle();
  const { site, source } = await createSiteWithScrapeSource({
    name: "Existing Reviews",
    kind: "review",
    websiteUrl: "https://existing.example/",
    createdById: user.id,
  });
  const [article] = await db
    .insert(externalReviewArticles)
    .values({
      externalSiteId: site.id,
      canonicalUrl: "https://existing.example/review/one",
    })
    .returning();
  if (!article) throw new Error("Failed to create test article.");
  const [original] = await db
    .insert(externalReviews)
    .values({
      articleId: article.id,
      sourceKey: `${article.canonicalUrl}#review-1`,
      name: "Example Whisky",
      reviewerName: "Reviewer",
    })
    .returning();
  if (!original) throw new Error("Failed to create test review.");
  const [newer] = await db
    .insert(externalReviews)
    .values({
      articleId: article.id,
      sourceKey: reviewSourceKey(original.name, original.reviewerName),
      name: original.name,
      reviewerName: original.reviewerName,
      bottleId: bottle.id,
      category: bottle.category,
      nativeScoreValue: 91,
      nativeScoreScale: 100,
      nativeScoreDisplay: "91/100",
      clip: "Fresh review summary.",
      version: 2,
      tags: ["smoke"],
      hidden: true,
    })
    .returning();
  if (!newer) throw new Error("Failed to create newer test review.");
  await db.insert(externalReviewBodies).values([
    {
      externalReviewId: original.id,
      body: "Older review body.",
      fetchedAt: new Date("2026-08-01T00:00:00Z"),
    },
    {
      externalReviewId: newer.id,
      body: "Newer review body.",
      fetchedAt: new Date("2026-09-01T00:00:00Z"),
    },
  ]);

  const revision = await createScrapeSourceRevision({
    scrapeSourceId: source.id,
    rules,
    author: "person",
    createdById: user.id,
  });
  await markPreviewPassed(revision.id);
  await activateScrapeSourceRevision({
    scrapeSourceId: source.id,
    revisionId: revision.id,
  });

  expect(await db.select().from(externalReviews)).toEqual([
    expect.objectContaining({
      id: original.id,
      sourceKey: reviewSourceKey(original.name, original.reviewerName),
      bottleId: bottle.id,
      category: bottle.category,
      nativeScoreValue: 91,
      nativeScoreScale: 100,
      nativeScoreDisplay: "91/100",
      clip: "Fresh review summary.",
      version: 2,
      tags: ["smoke"],
      hidden: false,
    }),
  ]);
  expect(await db.select().from(externalReviewBodies)).toEqual([
    {
      externalReviewId: original.id,
      body: "Newer review body.",
      fetchedAt: new Date("2026-09-01T00:00:00Z"),
    },
  ]);
});

test("refuses conflicting Bottle matches for the same review", async ({
  fixtures,
}) => {
  const user = await createUser();
  const originalBottle = await fixtures.Bottle();
  const newerBottle = await fixtures.Bottle();
  const { site, source } = await createSiteWithScrapeSource({
    name: "Conflicting Reviews",
    kind: "review",
    websiteUrl: "https://conflicting.example/",
    createdById: user.id,
  });
  const [article] = await db
    .insert(externalReviewArticles)
    .values({
      externalSiteId: site.id,
      canonicalUrl: "https://conflicting.example/review/one",
    })
    .returning();
  if (!article) throw new Error("Failed to create test article.");
  await db.insert(externalReviews).values([
    {
      articleId: article.id,
      sourceKey: `${article.canonicalUrl}#review-1`,
      name: "Example Whisky",
      reviewerName: "Reviewer",
      bottleId: originalBottle.id,
    },
    {
      articleId: article.id,
      sourceKey: reviewSourceKey("Example Whisky", "Reviewer"),
      name: "Example Whisky",
      reviewerName: "Reviewer",
      bottleId: newerBottle.id,
    },
  ]);
  const before = await db.select().from(externalReviews);
  const revision = await createScrapeSourceRevision({
    scrapeSourceId: source.id,
    rules,
    author: "person",
    createdById: user.id,
  });
  await markPreviewPassed(revision.id);

  await expect(
    activateScrapeSourceRevision({
      scrapeSourceId: source.id,
      revisionId: revision.id,
    }),
  ).rejects.toThrow("Two copies of the same review point to different Bottles");
  expect(await db.select().from(externalReviews)).toEqual(before);
});

test("refuses review identities that depend on page position", async () => {
  const user = await createUser();
  const { site, source } = await createSiteWithScrapeSource({
    name: "Repeated Reviews",
    kind: "review",
    websiteUrl: "https://repeated.example/",
    createdById: user.id,
  });
  const [article] = await db
    .insert(externalReviewArticles)
    .values({
      externalSiteId: site.id,
      canonicalUrl: "https://repeated.example/review/one",
    })
    .returning();
  if (!article) throw new Error("Failed to create test article.");
  await db.insert(externalReviews).values([
    {
      articleId: article.id,
      sourceKey: `${article.canonicalUrl}#review-1`,
      name: "Example Whisky",
      reviewerName: "Reviewer",
    },
    {
      articleId: article.id,
      sourceKey: `${article.canonicalUrl}#review-2`,
      name: "Example Whisky",
      reviewerName: "Reviewer",
    },
  ]);
  const before = await db.select().from(externalReviews);
  const revision = await createScrapeSourceRevision({
    scrapeSourceId: source.id,
    rules,
    author: "person",
    createdById: user.id,
  });
  await markPreviewPassed(revision.id);

  await expect(
    activateScrapeSourceRevision({
      scrapeSourceId: source.id,
      revisionId: revision.id,
    }),
  ).rejects.toThrow(
    "Each review in an article must have a unique name and writer combination",
  );
  expect(await db.select().from(externalReviews)).toEqual(before);
  expect(await db.select().from(scrapeSources)).toEqual([
    expect.objectContaining({ id: source.id, enabled: false }),
  ]);
});

test("does not activate a revision while a run is active", async () => {
  const user = await createUser();
  const { site, source } = await createSiteWithScrapeSource({
    name: "Busy Reviews",
    kind: "review",
    websiteUrl: "https://busy.example/",
    createdById: user.id,
  });
  const revision = await createScrapeSourceRevision({
    scrapeSourceId: source.id,
    rules,
    author: "person",
    createdById: user.id,
  });
  await markPreviewPassed(revision.id);
  await db.insert(externalSiteRuns).values({
    externalSiteId: site.id,
    status: "queued",
    trigger: "manual",
    purpose: "collect",
    requestLimit: 1,
  });

  await expect(
    activateScrapeSourceRevision({
      scrapeSourceId: source.id,
      revisionId: revision.id,
    }),
  ).rejects.toThrow("Wait for the current run to finish");
});

test("database constraints keep source and revision identity valid", async () => {
  const user = await createUser();
  const { source } = await createSiteWithScrapeSource({
    name: "Constraint Reviews",
    kind: "review",
    websiteUrl: "https://constraints.example/",
    createdById: user.id,
  });
  const first = await createScrapeSourceRevision({
    scrapeSourceId: source.id,
    rules,
    author: "person",
    createdById: user.id,
  });
  expect(first.revision).toBe(1);
  expect(first.rulesVersion).toBe(11);

  await expect(
    db.insert(scrapeSources).values({
      externalSiteId: source.externalSiteId,
      kind: "price",
      listUrl: "https://constraints.example/products",
      createdById: user.id,
    }),
  ).rejects.toThrow();
  await expect(
    db.insert(scrapeSourceRevisions).values({
      scrapeSourceId: source.id,
      revision: 2,
      rulesVersion: 1,
      listUrl: source.listUrl,
      rules,
      author: "ai",
      previewResult: { issues: [], pages: [] },
      createdById: user.id,
    }),
  ).rejects.toThrow();

  const [site] = await db
    .select()
    .from(externalSites)
    .where(eq(externalSites.type, "constraints-example"));
  expect(site).toBeDefined();
  await expect(
    db.insert(scrapeOrigins).values({
      origin: "https://invalid-policy.example",
      managedBy: "admin",
      targetKey: "constraints-example",
      robotsMode: "not_applicable",
    }),
  ).rejects.toThrow();
});

test("derives the internal key from the website hostname", () => {
  expect(createSiteKey(new URL("https://www.Example-Shop.com/"))).toBe(
    "example-shop-com",
  );
  expect(createSiteKey(new URL("http://127.0.0.1:4400/"))).toBe(
    "127-0-0-1-4400",
  );
});
