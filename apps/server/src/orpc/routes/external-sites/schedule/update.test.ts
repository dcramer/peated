import { db } from "@peated/server/db";
import { externalSites } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";

describe("PUT /admin/external-sites/:site/schedule", () => {
  test("requires an administrator", async ({ fixtures }) => {
    const site = await fixtures.ExternalSiteOrExisting({
      type: "whiskyadvocate",
    });
    const moderator = await fixtures.User({ mod: true });

    const error = await waitError(() =>
      routerClient.externalSites.schedule.update(
        { site: site.type, schedule: { runEvery: 1_440 } },
        { context: { user: moderator } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("makes an automatic scraper due now", async ({ fixtures }) => {
    const site = await fixtures.ExternalSiteOrExisting({
      type: "whiskyadvocate",
      runEvery: null,
      nextRunAt: null,
    });
    const administrator = await fixtures.User({ admin: true });
    const before = Date.now();

    const result = await routerClient.externalSites.schedule.update(
      { site: site.type, schedule: { runEvery: 10_080 } },
      { context: { user: administrator } },
    );

    expect(result.runEvery).toBe(10_080);
    expect(new Date(result.nextRunAt!).getTime()).toBeGreaterThanOrEqual(
      before,
    );
  });

  test("makes a scraper manual without disabling manual runs", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({
      type: "whiskyadvocate",
      runEvery: 1_440,
      nextRunAt: new Date("2026-08-30T12:00:00Z"),
    });
    const administrator = await fixtures.User({ admin: true });

    const result = await routerClient.externalSites.schedule.update(
      { site: site.type, schedule: { runEvery: null } },
      { context: { user: administrator } },
    );

    expect(result).toMatchObject({ runEvery: null, nextRunAt: null });
  });

  test("rejects automatic scheduling before setup is ready", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSite({ type: "unfinished-source" });
    const administrator = await fixtures.User({ admin: true });

    const error = await waitError(() =>
      routerClient.externalSites.schedule.update(
        { site: site.type, schedule: { runEvery: 60 } },
        { context: { user: administrator } },
      ),
    );

    expect(error).toMatchInlineSnapshot(
      `[Error: Set up this scraper before you schedule automatic runs.]`,
    );
    const [stored] = await db
      .select()
      .from(externalSites)
      .where(eq(externalSites.id, site.id));
    expect(stored).toMatchObject({ runEvery: site.runEvery });
  });
});
