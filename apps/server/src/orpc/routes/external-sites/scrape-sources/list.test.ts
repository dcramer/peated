import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
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
        site: expect.objectContaining({ type: "route-reviews-example" }),
      }),
    ]);
  });
});
