import { db } from "@peated/server/db";
import { externalSiteConfig } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("PUT /external-sites/:site/config/:key", () => {
  test("requires authentication", async () => {
    const err = await waitError(() =>
      routerClient.externalSites.config.set({
        site: "test" as any,
        key: "test",
        value: "test",
      })
    );
    expect(err).toMatchInlineSnapshot("[Error: Unauthorized.]");
  });

  test("requires admin", async ({ fixtures }) => {
    const site = await fixtures.ExternalSite();
    const user = await fixtures.User({ mod: true });

    const err = await waitError(() =>
      routerClient.externalSites.config.set(
        {
          site: site.type,
          key: "test",
          value: "test",
        },
        { context: { user } }
      )
    );
    expect(err).toMatchInlineSnapshot("[Error: Unauthorized.]");
  });

  test("returns error for non-existent site", async ({ fixtures }) => {
    const user = await fixtures.User({ admin: true });

    const err = await waitError(() =>
      routerClient.externalSites.config.set(
        {
          site: "non-existent-site" as any,
          key: "test",
          value: "test",
        },
        { context: { user } }
      )
    );
    expect(err).toMatchInlineSnapshot("[Error: Input validation failed]");
  });

  test("set new value", async ({ fixtures }) => {
    const site = await fixtures.ExternalSite();
    const user = await fixtures.User({ admin: true });

    await routerClient.externalSites.config.set(
      {
        site: site.type,
        key: "test",
        value: "bar",
      },
      { context: { user } }
    );

    const results = await db
      .select()
      .from(externalSiteConfig)
      .where(eq(externalSiteConfig.externalSiteId, site.id));
    expect(results.length).toEqual(1);
    expect(results[0].key).toEqual("test");
    expect(results[0].value).toEqual("bar");
  });

  test("update existing value", async ({ fixtures }) => {
    const site = await fixtures.ExternalSite();
    await db.insert(externalSiteConfig).values({
      externalSiteId: site.id,
      key: "test",
      value: { foo: "bar" },
    });

    const user = await fixtures.User({ admin: true });

    await routerClient.externalSites.config.set(
      {
        site: site.type,
        key: "test",
        value: "bar",
      },
      { context: { user } }
    );

    const results = await db
      .select()
      .from(externalSiteConfig)
      .where(eq(externalSiteConfig.externalSiteId, site.id));
    expect(results.length).toEqual(1);
    expect(results[0].key).toEqual("test");
    expect(results[0].value).toEqual("bar");
  });
});
