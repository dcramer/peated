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
import { createPinnedScrapeSourceRun } from "./runs";
import {
  activateScrapeSourceRevision,
  createScrapeSourceDraft,
  createSiteWithScrapeSource,
  listScrapeSourceRevisions,
  recordScrapeSourceValidation,
  ScrapeSourceConflictError,
  ScrapeSourceValidationError,
} from "./service";

const rules = {
  kind: "review" as const,
  list: {
    detailLink: { selector: "a.review", attribute: "href" },
    maxItems: 99,
  },
  detail: {
    title: { selector: "h1" },
    reviewItem: "article.review",
    name: { selector: "h2" },
  },
};

async function createUser() {
  const [user] = await db
    .insert(users)
    .values({ username: "admin", email: "admin@example.com", admin: true })
    .returning();
  if (!user) throw new Error("Failed to create test user.");
  return user;
}

test("creates a site and its governed admin-owned traffic rows", async () => {
  const user = await createUser();
  const created = await createSiteWithScrapeSource({
    key: "example-reviews",
    name: "Example Reviews",
    kind: "review",
    listUrl: "https://reviews.example/archive",
    sampleUrls: ["https://reviews.example/review/one"],
    createdById: user.id,
  });

  expect(created.source).toMatchObject({
    kind: "review",
    enabled: false,
    listUrl: "https://reviews.example/archive",
  });
  expect(await db.select().from(scrapeTargets)).toEqual([
    expect.objectContaining({
      key: "example-reviews",
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
      key: "example-reviews",
      name: "Duplicate",
      kind: "review",
      listUrl: "https://duplicate.example/archive",
      createdById: user.id,
    }),
  ).rejects.toBeInstanceOf(ScrapeSourceConflictError);
});

test("keeps immutable revisions and only activates a passing revision", async () => {
  const user = await createUser();
  const { site, source } = await createSiteWithScrapeSource({
    key: "versioned-reviews",
    name: "Versioned Reviews",
    kind: "review",
    listUrl: "https://versioned.example/archive",
    createdById: user.id,
  });
  const first = await createScrapeSourceDraft({
    scrapeSourceId: source.id,
    rules,
    createdWith: "person",
    createdById: user.id,
  });
  await expect(
    activateScrapeSourceRevision({
      scrapeSourceId: source.id,
      revisionId: first.id,
    }),
  ).rejects.toBeInstanceOf(ScrapeSourceValidationError);

  await recordScrapeSourceValidation({
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

  const second = await createScrapeSourceDraft({
    scrapeSourceId: source.id,
    listUrl: "https://versioned.example/new-archive",
    rules: {
      ...rules,
      detail: { ...rules.detail, title: { selector: "main h1" } },
    },
    createdWith: "person",
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
  expect(pinned.run.requestLimit).toBe(100);
  expect(await db.select().from(scrapeSourceRuns)).toEqual([
    expect.objectContaining({
      externalSiteRunId: pinned.run.id,
      scrapeSourceId: source.id,
      revisionId: first.id,
      purpose: "collect",
    }),
  ]);

  await recordScrapeSourceValidation({
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
    key: "constraint-reviews",
    name: "Constraint Reviews",
    kind: "review",
    listUrl: "https://constraints.example/archive",
    createdById: user.id,
  });
  const first = await createScrapeSourceDraft({
    scrapeSourceId: source.id,
    rules,
    createdWith: "person",
    createdById: user.id,
  });
  expect(first.revision).toBe(1);

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
      formatVersion: 1,
      listUrl: source.listUrl,
      rules,
      createdWith: "ai",
      validationResult: { issues: [], pages: [] },
      createdById: user.id,
    }),
  ).rejects.toThrow();

  const [site] = await db
    .select()
    .from(externalSites)
    .where(eq(externalSites.type, "constraint-reviews"));
  expect(site).toBeDefined();
  await expect(
    db.insert(scrapeOrigins).values({
      origin: "https://invalid-policy.example",
      managedBy: "admin",
      targetKey: "constraint-reviews",
      robotsMode: "not_applicable",
    }),
  ).rejects.toThrow();
});
