import { db } from "@peated/server/db";
import {
  externalReviewArticles,
  externalSiteRuns,
  scrapeOrigins,
  scrapeSourceRevisions,
  scrapeSourceRuns,
  users,
} from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import { vi } from "vitest";
import { createScraperRegistry } from "../definitions";
import type { ScraperHttpClock } from "../http";
import { executeScraperRun } from "../runs";
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

function fixedClock(): ScraperHttpClock {
  let now = new Date("2026-08-28T12:00:00Z");
  return {
    now: () => now,
    sleep: async (milliseconds) => {
      now = new Date(now.getTime() + milliseconds);
    },
    random: () => 0,
  };
}

async function setupSource(titleSelector = "h1") {
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
    rules: {
      kind: "review",
      list: {
        detailLink: { selector: "a.review", attribute: "href" },
        maxItems: 5,
      },
      detail: {
        title: { selector: titleSelector },
        reviewItem: "article.review",
        name: { selector: "h2" },
        reviewText: { selector: ".body" },
      },
    },
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

async function setupPreview(titleSelector = "h1") {
  const created = await setupSource(titleSelector);
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

function previewFetch() {
  return vi.fn<typeof fetch>(async (input) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.pathname === "/archive") {
      return new Response('<a class="review" href="/one">One</a>');
    }
    if (url.pathname === "/one") {
      return new Response(
        '<h1>August reviews</h1><article class="review"><h2>Example Whisky</h2><div class="body">Publisher prose must not be stored in preview.</div></article>',
      );
    }
    throw new Error(`Unexpected URL: ${url.toString()}`);
  });
}

test("runs preview through the normal request controls without product writes", async () => {
  const { pinned, revision } = await setupPreview();
  await expect(
    executeScraperRun(
      { runId: pinned.run.id },
      {
        registry: createScraperRegistry({ targets: [], sources: [] }),
        fetchImpl: previewFetch(),
        clock: fixedClock(),
        executionToken: "preview-owner",
      },
    ),
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
  const [run] = await db
    .select()
    .from(externalSiteRuns)
    .where(eq(externalSiteRuns.id, pinned.run.id));
  expect(run).toMatchObject({ status: "succeeded", emittedItemCount: 0 });
});

test("stores safe validation issues when a selector stops matching", async () => {
  const { pinned, revision } = await setupPreview("h3.missing");
  await expect(
    executeScraperRun(
      { runId: pinned.run.id },
      {
        registry: createScraperRegistry({ targets: [], sources: [] }),
        fetchImpl: previewFetch(),
        clock: fixedClock(),
        executionToken: "preview-owner",
      },
    ),
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
    executeScraperRun(
      { runId: pinned.run.id },
      {
        registry: createScraperRegistry({ targets: [], sources: [] }),
        fetchImpl: previewFetch(),
        clock: fixedClock(),
        executionToken: "collection-owner",
      },
    ),
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
    allowAiSuggestions: true,
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
    rules: {
      kind: "review",
      list: {
        detailLink: { selector: "a.review", attribute: "href" },
        maxItems: 5,
      },
      detail: {
        title: { selector: "h1" },
        reviewItem: "article.review",
        name: { selector: "h2" },
      },
    },
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
