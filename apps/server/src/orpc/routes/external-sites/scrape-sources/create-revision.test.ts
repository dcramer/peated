import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";
import { createTestSource, reviewRules } from "./testUtils";

describe("POST /admin/scrape-sources/:id/revisions", () => {
  test("requires an administrator", async ({ defaults }) => {
    const error = await waitError(() =>
      routerClient.externalSites.scrapeSources.createRevision(
        {
          id: 1,
          listUrl: "https://route-reviews.example/archive",
          rules: reviewRules,
        },
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("reports a missing source", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    const error = await waitError(() =>
      routerClient.externalSites.scrapeSources.createRevision(
        {
          id: 999,
          listUrl: "https://route-reviews.example/archive",
          rules: reviewRules,
        },
        { context: { user: admin } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Source not found.]`);
  });

  test("rejects a list page on another website", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    const { source } = await createTestSource(admin.id);
    const error = await waitError(() =>
      routerClient.externalSites.scrapeSources.createRevision(
        {
          id: source.id,
          listUrl: "https://other.example/archive",
          rules: reviewRules,
        },
        { context: { user: admin } },
      ),
    );

    expect(error).toMatchInlineSnapshot(
      `[Error: The list page must stay on the source website.]`,
    );
  });

  test("saves an inactive revision", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    const { source } = await createTestSource(admin.id);

    const revision =
      await routerClient.externalSites.scrapeSources.createRevision(
        {
          id: source.id,
          listUrl: source.listUrl,
          rules: reviewRules,
        },
        { context: { user: admin } },
      );

    expect(revision).toMatchObject({
      active: false,
      author: "person",
      previewStatus: "pending",
      revision: 1,
    });
  });
});
