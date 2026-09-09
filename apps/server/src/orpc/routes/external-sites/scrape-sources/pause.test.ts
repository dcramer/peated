import { db } from "@peated/server/db";
import {
  externalSiteRuns,
  externalSites,
  scrapeSourceRevisions,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { createPinnedScrapeSourceRun } from "@peated/server/scraper/configured/runs";
import {
  activateScrapeSourceRevision,
  SCRAPE_SOURCE_PAUSED_ERROR,
} from "@peated/server/scraper/configured/service";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import { createTestRevision, createTestSource } from "./testUtils";

describe("POST /admin/scrape-sources/:id/pause", () => {
  test("requires an administrator", async ({ defaults }) => {
    const error = await waitError(() =>
      routerClient.externalSites.scrapeSources.pause(
        { id: 1 },
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("reports a missing source", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    const error = await waitError(() =>
      routerClient.externalSites.scrapeSources.pause(
        { id: 999 },
        { context: { user: admin } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Source not found.]`);
  });

  test("pauses a source", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    const { source } = await createTestSource(admin.id);

    await expect(
      routerClient.externalSites.scrapeSources.pause(
        { id: source.id },
        { context: { user: admin } },
      ),
    ).resolves.toEqual({ enabled: false });
  });

  test("stops queued collection without reviving it later", async ({
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });
    const { site, source } = await createTestSource(admin.id);
    const revision = await createTestRevision(source.id, admin.id);
    await db
      .update(scrapeSourceRevisions)
      .set({
        previewStatus: "passed",
        previewResult: { issues: [], pages: [] },
        previewedAt: new Date(),
      })
      .where(eq(scrapeSourceRevisions.id, revision.id));
    await activateScrapeSourceRevision({
      scrapeSourceId: source.id,
      revisionId: revision.id,
    });
    const stopped = await createPinnedScrapeSourceRun(db, {
      externalSiteId: site.id,
      requestedById: admin.id,
      trigger: "manual",
      purpose: "collect",
    });

    await routerClient.externalSites.scrapeSources.pause(
      { id: source.id },
      { context: { user: admin } },
    );

    const [stoppedRun] = await db
      .select()
      .from(externalSiteRuns)
      .where(eq(externalSiteRuns.id, stopped.run.id));
    const [storedSite] = await db
      .select()
      .from(externalSites)
      .where(eq(externalSites.id, site.id));
    expect(stoppedRun).toMatchObject({
      status: "failed",
      error: SCRAPE_SOURCE_PAUSED_ERROR,
      nextAttemptAt: null,
      executionToken: null,
      executionExpiresAt: null,
    });
    expect(stoppedRun?.completedAt).toBeInstanceOf(Date);
    expect(storedSite).toMatchObject({
      lastRunAt: stoppedRun?.completedAt,
      lastRunId: stopped.run.id,
    });

    await activateScrapeSourceRevision({
      scrapeSourceId: source.id,
      revisionId: revision.id,
    });
    const later = await createPinnedScrapeSourceRun(db, {
      externalSiteId: site.id,
      requestedById: admin.id,
      trigger: "manual",
      purpose: "collect",
    });
    expect(later.run).toMatchObject({ status: "queued" });
    expect(later.run.id).not.toBe(stopped.run.id);
    const [stillStopped] = await db
      .select()
      .from(externalSiteRuns)
      .where(eq(externalSiteRuns.id, stopped.run.id));
    expect(stillStopped).toMatchObject({
      status: "failed",
      error: SCRAPE_SOURCE_PAUSED_ERROR,
    });
  });
});
