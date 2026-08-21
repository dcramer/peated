import { db } from "@peated/server/db";
import { externalSiteRuns } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { pushJob } from "@peated/server/worker/client";
import { eq } from "drizzle-orm";

vi.mock("@peated/server/worker/client");

describe("POST /external-sites/:site/trigger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("requires admin", async ({ fixtures }) => {
    const site = await fixtures.ExternalSiteOrExisting({
      type: "whiskyadvocate",
    });
    const modUser = await fixtures.User({ mod: true });

    const err = await waitError(
      routerClient.externalSites.triggerJob(
        { site: site.type },
        { context: { user: modUser } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("triggers a review job without a publication policy", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({
      type: "whiskyadvocate",
    });
    const adminUser = await fixtures.User({ admin: true });

    const result = await routerClient.externalSites.triggerJob(
      { site: site.type },
      { context: { user: adminUser } },
    );

    expect(result).toMatchObject({
      status: "queued",
      trigger: "manual",
      requestedById: adminUser.id,
    });
    expect(pushJob).toHaveBeenCalledOnce();
  });

  test("refuses a disabled scraper before creating durable work", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const adminUser = await fixtures.User({ admin: true });

    const err = await waitError(
      routerClient.externalSites.triggerJob(
        { site: site.type },
        { context: { user: adminUser } },
      ),
    );

    expect(err).toMatchInlineSnapshot(
      `[Error: Scraper target totalwine is disabled.]`,
    );
    expect(pushJob).not.toHaveBeenCalled();
    await expect(
      db
        .select()
        .from(externalSiteRuns)
        .where(eq(externalSiteRuns.externalSiteId, site.id)),
    ).resolves.toHaveLength(0);
  });
});
