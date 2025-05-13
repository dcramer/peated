import { db } from "@peated/server/db";
import { externalSiteConfig } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { describe, expect, test } from "vitest";
import { routerClient } from "../router";

describe("GET /external-sites/:site/config/:key", () => {
  test("requires admin", async ({ fixtures }) => {
    const site = await fixtures.ExternalSite();
    const user = await fixtures.User({ mod: true });

    const err = await waitError(() =>
      routerClient.externalSiteConfigGet(
        {
          site: site.type,
          key: "test",
        },
        { context: { user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`
      [ORPCError: FORBIDDEN: Admin privileges required]
    `);
  });

  test("get missing value", async ({ fixtures }) => {
    const site = await fixtures.ExternalSite();
    const user = await fixtures.User({ admin: true });

    const data = await routerClient.externalSiteConfigGet(
      {
        site: site.type,
        key: "test",
      },
      { context: { user } },
    );
    expect(data).toBeNull();
  });

  test("get missing value with default", async ({ fixtures }) => {
    const site = await fixtures.ExternalSite();
    const user = await fixtures.User({ admin: true });

    const data = await routerClient.externalSiteConfigGet(
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
    const site = await fixtures.ExternalSite();
    await db.insert(externalSiteConfig).values({
      externalSiteId: site.id,
      key: "test",
      value: { foo: "bar" },
    });

    const user = await fixtures.User({ admin: true });

    const data = await routerClient.externalSiteConfigGet(
      {
        site: site.type,
        key: "test",
      },
      { context: { user } },
    );
    expect(data).toEqual({ foo: "bar" });
  });
});
