import { db } from "@peated/server/db";
import {
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
import type { ScrapeRules } from "./rules";
import { createPinnedScrapeSourceRun } from "./runs";
import {
  activateScrapeSourceRevision,
  createScrapeSourceRevision,
  createSiteKey,
  createSiteWithScrapeSource,
  listScrapeSourceRevisions,
  recordScrapeSourcePreview,
  ScrapeSourceConflictError,
  ScrapeSourceValidationError,
} from "./service";

const rules = {
  kind: "review",
  articles: {
    oneArticlePer: "body",
    link: "a.review",
    skipWhen: null,
    nextPage: null,
    limit: 99,
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
      try: [{ get: "fixed", value: "2026-01-01", clean: null }],
    },
    reviews: {
      inside: "body",
      oneReviewPer: "element",
      selector: "article.review",
      name: {
        try: [
          {
            get: "text",
            from: "review",
            selector: "h2",
            take: "first",
            startsWith: null,
            clean: null,
          },
        ],
      },
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

  await recordScrapeSourcePreview({
    revisionId: first.id,
    status: "passed",
    result: { issues: [], pages: [] },
  });
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
      article: {
        ...rules.article,
        title: {
          try: [
            {
              get: "text",
              selector: "main h1",
              take: "first",
              startsWith: null,
              clean: null,
            },
          ],
        },
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

  await recordScrapeSourcePreview({
    revisionId: second.id,
    status: "passed",
    result: { issues: [], pages: [] },
  });
  const updated = await activateScrapeSourceRevision({
    scrapeSourceId: source.id,
    revisionId: second.id,
  });
  expect(updated.source.listUrl).toBe("https://versioned.example/new-archive");
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
  expect(first.rulesVersion).toBe(6);

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
