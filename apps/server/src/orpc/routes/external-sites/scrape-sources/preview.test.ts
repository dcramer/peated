import waitError from "@peated/server/lib/test/waitError";
import { pushJob } from "@peated/server/lib/test/workerDispatch";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";
import { createTestRevision, createTestSource } from "./testUtils";

describe("POST /admin/scrape-sources/:id/revisions/:revisionId/preview", () => {
  test("requires an administrator", async ({ defaults }) => {
    const error = await waitError(() =>
      routerClient.externalSites.scrapeSources.preview(
        { id: 1, revisionId: 1 },
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("reports a missing source", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    const error = await waitError(() =>
      routerClient.externalSites.scrapeSources.preview(
        { id: 999, revisionId: 999 },
        { context: { user: admin } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Source not found.]`);
  });

  test("rejects a revision from another source", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    const first = await createTestSource(admin.id, { key: "first-reviews" });
    const second = await createTestSource(admin.id, {
      key: "second-reviews",
    });
    const revision = await createTestRevision(second.source.id, admin.id);
    const error = await waitError(() =>
      routerClient.externalSites.scrapeSources.preview(
        { id: first.source.id, revisionId: revision.id },
        { context: { user: admin } },
      ),
    );

    expect(error).toMatchInlineSnapshot(
      `[Error: Exactly one tested source revision must be ready for this run.]`,
    );
  });

  test("queues a preview", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    const { source } = await createTestSource(admin.id);
    const revision = await createTestRevision(source.id, admin.id);

    const run = await routerClient.externalSites.scrapeSources.preview(
      { id: source.id, revisionId: revision.id },
      { context: { user: admin } },
    );

    expect(run).toMatchObject({
      requestedById: admin.id,
      status: "queued",
      trigger: "manual",
    });
    expect(pushJob).toHaveBeenCalledOnce();
  });
});
