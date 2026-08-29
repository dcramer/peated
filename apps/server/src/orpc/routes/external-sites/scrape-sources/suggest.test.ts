import waitError from "@peated/server/lib/test/waitError";
import { pushJob } from "@peated/server/lib/test/workerDispatch";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";
import { createTestSource } from "./testUtils";

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
});
