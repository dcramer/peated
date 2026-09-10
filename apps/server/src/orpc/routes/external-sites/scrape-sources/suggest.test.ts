import { db } from "@peated/server/db";
import {
  externalSiteRuns,
  scrapeSourceRevisions,
  scrapeSources,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { pushJob } from "@peated/server/lib/test/workerDispatch";
import { routerClient } from "@peated/server/orpc/router";
import { activateScrapeSourceRevision } from "@peated/server/scraper/configured/service";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import { createTestRevision, createTestSource } from "./testUtils";

describe("POST /admin/scrape-sources/:id/suggest", () => {
  test("requires an administrator", async ({ defaults }) => {
    const error = await waitError(() =>
      routerClient.externalSites.scrapeSources.suggest(
        { id: 1 },
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("reports a missing source", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    const error = await waitError(() =>
      routerClient.externalSites.scrapeSources.suggest(
        { id: 999 },
        { context: { user: admin } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Source not found.]`);
  });

  test("queues a suggestion", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    const { source } = await createTestSource(admin.id);

    const run = await routerClient.externalSites.scrapeSources.suggest(
      { id: source.id },
      { context: { user: admin } },
    );

    expect(run).toMatchObject({
      requestedById: admin.id,
      status: "queued",
      trigger: "manual",
    });
    expect(pushJob).toHaveBeenCalledOnce();
  });

  test.for(["pending", "passed"] as const)(
    "rebuilds a %s inactive proposal without changing active rules",
    async (previewStatus, { fixtures }) => {
      const admin = await fixtures.User({ admin: true });
      const { source } = await createTestSource(admin.id);
      const active = await createTestRevision(source.id, admin.id);
      await db
        .update(scrapeSourceRevisions)
        .set({ previewStatus: "passed" })
        .where(eq(scrapeSourceRevisions.id, active.id));
      await activateScrapeSourceRevision({
        scrapeSourceId: source.id,
        revisionId: active.id,
      });
      await db
        .update(scrapeSourceRevisions)
        .set({ rulesVersion: 10 })
        .where(eq(scrapeSourceRevisions.id, active.id));
      const proposal = await createTestRevision(source.id, admin.id);
      await db
        .update(scrapeSourceRevisions)
        .set({ previewStatus })
        .where(eq(scrapeSourceRevisions.id, proposal.id));
      const before = await db.select().from(scrapeSourceRevisions);
      const sourcesBefore = await db.select().from(scrapeSources);

      const run = await routerClient.externalSites.scrapeSources.suggest(
        { id: source.id },
        { context: { user: admin } },
      );

      expect(run).toMatchObject({
        status: "queued",
        purpose: "suggest",
        requestedById: admin.id,
      });
      expect(await db.select().from(scrapeSourceRevisions)).toEqual(before);
      expect(await db.select().from(scrapeSources)).toEqual(sourcesBefore);
      expect(pushJob).toHaveBeenCalledOnce();
    },
  );

  test("concurrent rebuild requests queue only one run", async ({
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });
    const { source } = await createTestSource(admin.id);
    await createTestRevision(source.id, admin.id);

    const results = await Promise.allSettled([
      routerClient.externalSites.scrapeSources.suggest(
        { id: source.id },
        { context: { user: admin } },
      ),
      routerClient.externalSites.scrapeSources.suggest(
        { id: source.id },
        { context: { user: admin } },
      ),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    expect(await db.select().from(externalSiteRuns)).toMatchObject([
      { status: "queued", purpose: "suggest" },
    ]);
    expect(pushJob).toHaveBeenCalledOnce();
  });
});
