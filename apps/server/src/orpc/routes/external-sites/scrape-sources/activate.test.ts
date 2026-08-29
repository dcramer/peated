import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { recordScrapeSourcePreview } from "@peated/server/scraper/configured/service";
import { describe, expect, test } from "vitest";
import { createTestRevision, createTestSource } from "./testUtils";

describe("POST /admin/scrape-sources/:id/revisions/:revisionId/activate", () => {
  test("requires an administrator", async ({ defaults }) => {
    const error = await waitError(() =>
      routerClient.externalSites.scrapeSources.activate(
        { id: 1, revisionId: 1 },
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("reports a missing source", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    const error = await waitError(() =>
      routerClient.externalSites.scrapeSources.activate(
        { id: 999, revisionId: 999 },
        { context: { user: admin } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Source not found.]`);
  });

  test("requires a passing preview", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    const { source } = await createTestSource(admin.id);
    const revision = await createTestRevision(source.id, admin.id);
    const error = await waitError(() =>
      routerClient.externalSites.scrapeSources.activate(
        { id: source.id, revisionId: revision.id },
        { context: { user: admin } },
      ),
    );

    expect(error).toMatchInlineSnapshot(
      `[Error: Preview this version successfully before you activate it.]`,
    );
  });

  test("activates a revision that passed preview", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    const { source } = await createTestSource(admin.id);
    const revision = await createTestRevision(source.id, admin.id);
    await recordScrapeSourcePreview({
      revisionId: revision.id,
      status: "passed",
      result: { issues: [], pages: [] },
    });

    await expect(
      routerClient.externalSites.scrapeSources.activate(
        { id: source.id, revisionId: revision.id },
        { context: { user: admin } },
      ),
    ).resolves.toEqual({ activeRevisionId: revision.id });
  });
});
