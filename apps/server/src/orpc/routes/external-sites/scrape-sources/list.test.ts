import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { createScrapeSourceSuggestionRun } from "@peated/server/scraper/configured/runs";
import { describe, expect, test } from "vitest";
import { createTestSource } from "./testUtils";

describe("GET /admin/scrape-sources", () => {
  test("requires an administrator", async ({ defaults }) => {
    const error = await waitError(() =>
      routerClient.externalSites.scrapeSources.list(
        {},
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("lists a source with its revisions", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    const { source } = await createTestSource(admin.id);

    const result = await routerClient.externalSites.scrapeSources.list(
      { site: "route-reviews-example" },
      { context: { user: admin } },
    );

    expect(result).toEqual([
      expect.objectContaining({
        id: source.id,
        revisions: [],
        setup: null,
        site: expect.objectContaining({ type: "route-reviews-example" }),
      }),
    ]);
  });

  test("shows the latest AI setup run", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    const { source } = await createTestSource(admin.id, {
      host: "route-setup-status",
    });
    const setup = await createScrapeSourceSuggestionRun({
      scrapeSourceId: source.id,
      requestedById: admin.id,
    });

    const [result] = await routerClient.externalSites.scrapeSources.list(
      { site: "route-setup-status-example" },
      { context: { user: admin } },
    );

    expect(result?.setup).toMatchObject({
      runId: setup.id,
      status: "queued",
      error: null,
    });
  });
});
