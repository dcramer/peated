import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

const input = {
  key: "route-reviews",
  name: "Route Reviews",
  kind: "review" as const,
  listUrl: "https://route-reviews.example/archive",
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
      listUrl: input.listUrl,
      site: { name: input.name, type: input.key },
    });
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
      `[Error: Example pages must use the same website as the list page.]`,
    );
  });

  test("reports a duplicate key as a conflict", async ({ fixtures }) => {
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
      `[Error: A source with this short name already exists.]`,
    );
  });
});
