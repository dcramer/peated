import { db } from "@peated/server/db";
import {
  configuredScraperConfigVersions,
  externalReviewArticles,
  externalSiteRuns,
  scrapeOrigins,
  users,
} from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import { vi } from "vitest";
import { createScraperRegistry } from "../definitions";
import type { ScraperHttpClock } from "../http";
import { executeScraperRun } from "../runs";
import { createPinnedConfiguredRun } from "./runs";
import {
  createConfiguredScraperDraft,
  createConfiguredScraperSite,
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

async function setupPreview(titleSelector = "h1") {
  const [user] = await db
    .insert(users)
    .values({ username: "admin", email: "admin@example.com", admin: true })
    .returning();
  if (!user) throw new Error("Failed to create user.");
  const { site, scraper } = await createConfiguredScraperSite({
    key: "preview-reviews",
    name: "Preview Reviews",
    collection: "reviews",
    indexUrl: "https://preview.example/archive",
    createdById: user.id,
  });
  const version = await createConfiguredScraperDraft({
    configuredScraperId: scraper.id,
    createdWith: "person",
    createdById: user.id,
    config: {
      engineVersion: 1,
      collection: "reviews",
      index: {
        itemLink: { selector: "a.review", attribute: "href" },
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
  const pinned = await createPinnedConfiguredRun(db, {
    externalSiteId: site.id,
    configVersionId: version.id,
    requestedById: user.id,
    trigger: "manual",
    purpose: "preview",
  });
  return { pinned, version };
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

test("runs preview through the governed runtime without product writes", async () => {
  const { pinned, version } = await setupPreview();
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

  const [storedVersion] = await db
    .select()
    .from(configuredScraperConfigVersions)
    .where(eq(configuredScraperConfigVersions.id, version.id));
  expect(storedVersion).toMatchObject({ validationStatus: "passed" });
  expect(JSON.stringify(storedVersion?.validationResult)).not.toContain(
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
  const { pinned, version } = await setupPreview("h3.missing");
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

  const [storedVersion] = await db
    .select()
    .from(configuredScraperConfigVersions)
    .where(eq(configuredScraperConfigVersions.id, version.id));
  expect(storedVersion).toMatchObject({ validationStatus: "failed" });
  expect(storedVersion?.validationResult).toMatchObject({
    pages: [],
    issues: [expect.objectContaining({ field: "article.title" })],
  });
});
