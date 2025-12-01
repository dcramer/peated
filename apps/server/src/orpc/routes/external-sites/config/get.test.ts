import { db } from "@peated/server/db";
import { externalSiteConfig } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

describe("GET /external-sites/:site/config/:key", () => {
  test("requires admin", async ({ fixtures }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const user = await fixtures.User({ mod: true });

    const err = await waitError(() =>
      routerClient.externalSites.config.get(
        {
          site: site.type,
          key: "test",
        },
        { context: { user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("get missing value", async ({ fixtures }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const user = await fixtures.User({ admin: true });

    const data = await routerClient.externalSites.config.get(
      {
        site: site.type,
        key: "test",
      },
      { context: { user } },
    );
    expect(data).toBeNull();
  });

  test("get missing value with default", async ({ fixtures }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const user = await fixtures.User({ admin: true });

    const data = await routerClient.externalSites.config.get(
      {
        site: site.type,
        key: "test",
        default: [],
      },
      { context: { user } },
    );
    expect(data).toEqual([]);
  });

  test("get present value", async ({ fixtures }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    await db.insert(externalSiteConfig).values({
      externalSiteId: site.id,
      key: "test",
      value: { foo: "bar" },
    });

    const user = await fixtures.User({ admin: true });

    const data = await routerClient.externalSites.config.get(
      {
        site: site.type,
        key: "test",
      },
      { context: { user } },
    );
    expect(data).toEqual({ foo: "bar" });
  });
});
