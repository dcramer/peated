import waitError from "@peated/server/lib/test/waitError";
import { pushJob } from "@peated/server/lib/test/workerDispatch";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

const input = {
  name: "Route Reviews",
  kind: "review" as const,
  websiteUrl: "https://route-reviews.example/",
};

describe("POST /admin/scrape-sources", () => {
  test("requires an administrator", async ({ defaults }) => {
    const error = await waitError(() =>
      routerClient.externalSites.scrapeSources.create(input, {
        context: { user: defaults.user },
      }),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("creates a disabled source", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });

    const source = await routerClient.externalSites.scrapeSources.create(
      input,
      { context: { user: admin } },
    );

    expect(source).toMatchObject({
      activeRevisionId: null,
      enabled: false,
      kind: "review",
      listUrl: input.websiteUrl,
      setup: expect.objectContaining({ status: "queued" }),
      site: { name: input.name, type: "route-reviews-example" },
    });
    expect(pushJob).toHaveBeenCalledOnce();
  });

  test("rejects sample pages on another website", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    const error = await waitError(() =>
      routerClient.externalSites.scrapeSources.create(
        { ...input, sampleUrls: ["https://other.example/review"] },
        { context: { user: admin } },
      ),
    );

    expect(error).toMatchInlineSnapshot(
      `[Error: Example pages must use the source website.]`,
    );
  });

  test("reports an existing website as a conflict", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    await routerClient.externalSites.scrapeSources.create(input, {
      context: { user: admin },
    });

    const error = await waitError(() =>
      routerClient.externalSites.scrapeSources.create(input, {
        context: { user: admin },
      }),
    );

    expect(error).toMatchInlineSnapshot(
      `[Error: A source for this website already exists.]`,
    );
  });
});
