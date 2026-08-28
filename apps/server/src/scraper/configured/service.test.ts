import { db } from "@peated/server/db";
import {
  configuredScraperRuns,
  configuredScrapers,
  externalSites,
  externalSiteScrapeTargets,
  scrapeOrigins,
  scrapeTargets,
  users,
} from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import { createPinnedConfiguredRun } from "./runs";
import {
  activateConfiguredScraperVersion,
  ConfiguredScraperConflictError,
  ConfiguredScraperValidationError,
  createConfiguredScraperDraft,
  createConfiguredScraperSite,
  listConfiguredScraperVersions,
  recordConfiguredScraperValidation,
} from "./service";

const config = {
  engineVersion: 1 as const,
  collection: "reviews" as const,
  index: {
    itemLink: { selector: "a.review", attribute: "href" },
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
  const created = await createConfiguredScraperSite({
    key: "example-reviews",
    name: "Example Reviews",
    collection: "reviews",
    indexUrl: "https://reviews.example/archive",
    sampleUrls: ["https://reviews.example/review/one"],
    createdById: user.id,
  });

  expect(created.scraper).toMatchObject({
    collection: "reviews",
    enabled: false,
    activeConfigVersionId: null,
  });
  expect(await db.select().from(scrapeTargets)).toEqual([
    expect.objectContaining({
      key: "example-reviews",
      owner: "admin",
      enabled: true,
    }),
  ]);
  expect(await db.select().from(scrapeOrigins)).toEqual([
    expect.objectContaining({
      origin: "https://reviews.example",
      owner: "admin",
      robotsMode: "enforce",
    }),
  ]);
  expect(await db.select().from(externalSiteScrapeTargets)).toEqual([
    expect.objectContaining({
      externalSiteId: created.site.id,
      owner: "admin",
    }),
  ]);

  await expect(
    createConfiguredScraperSite({
      key: "example-reviews",
      name: "Duplicate",
      collection: "reviews",
      indexUrl: "https://duplicate.example/archive",
      createdById: user.id,
    }),
  ).rejects.toBeInstanceOf(ConfiguredScraperConflictError);
});

test("keeps immutable versions and only activates a passing version", async () => {
  const user = await createUser();
  const { site, scraper } = await createConfiguredScraperSite({
    key: "versioned-reviews",
    name: "Versioned Reviews",
    collection: "reviews",
    indexUrl: "https://versioned.example/archive",
    createdById: user.id,
  });
  const first = await createConfiguredScraperDraft({
    configuredScraperId: scraper.id,
    config,
    createdWith: "person",
    createdById: user.id,
  });
  await expect(
    activateConfiguredScraperVersion({
      configuredScraperId: scraper.id,
      configVersionId: first.id,
    }),
  ).rejects.toBeInstanceOf(ConfiguredScraperValidationError);

  await recordConfiguredScraperValidation({
    configVersionId: first.id,
    status: "passed",
    result: { issues: [], pages: [] },
  });
  const activated = await activateConfiguredScraperVersion({
    configuredScraperId: scraper.id,
    configVersionId: first.id,
  });
  expect(activated.scraper).toMatchObject({
    enabled: true,
    activeConfigVersionId: first.id,
  });

  const second = await createConfiguredScraperDraft({
    configuredScraperId: scraper.id,
    config: {
      ...config,
      detail: { ...config.detail, title: { selector: "main h1" } },
    },
    createdWith: "person",
    createdById: user.id,
  });
  expect(second.version).toBe(2);
  expect(
    (await listConfiguredScraperVersions(scraper.id)).map((v) => v.id),
  ).toEqual([second.id, first.id]);

  const pinned = await createPinnedConfiguredRun(db, {
    externalSiteId: site.id,
    requestedById: user.id,
    trigger: "manual",
    purpose: "collect",
  });
  expect(pinned.version.id).toBe(first.id);
  expect(pinned.run.requestLimit).toBe(100);
  expect(await db.select().from(configuredScraperRuns)).toEqual([
    expect.objectContaining({
      externalSiteRunId: pinned.run.id,
      configuredScraperId: scraper.id,
      configVersionId: first.id,
      purpose: "collect",
    }),
  ]);
});

test("database constraints reject invalid ownership metadata", async () => {
  const user = await createUser();
  const { scraper } = await createConfiguredScraperSite({
    key: "constraint-reviews",
    name: "Constraint Reviews",
    collection: "reviews",
    indexUrl: "https://constraints.example/archive",
    createdById: user.id,
  });
  const first = await createConfiguredScraperDraft({
    configuredScraperId: scraper.id,
    config,
    createdWith: "person",
    createdById: user.id,
  });
  expect(first.version).toBe(1);

  await expect(
    db.insert(configuredScrapers).values({
      externalSiteId: scraper.externalSiteId,
      collection: "store_prices",
      indexUrl: "https://constraints.example/products",
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
      owner: "admin",
      targetKey: "constraint-reviews",
      robotsMode: "not_applicable",
    }),
  ).rejects.toThrow();
});
