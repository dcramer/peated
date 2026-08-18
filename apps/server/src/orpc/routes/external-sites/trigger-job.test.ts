import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { pushJob } from "@peated/server/worker/client";

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

  test("triggers job", async ({ fixtures }) => {
    const site = await fixtures.ExternalSiteOrExisting({
      type: "whiskyadvocate",
    });
    await fixtures.ApprovedExternalReviewSourcePolicy({
      externalSiteId: site.id,
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

  test("refuses an unapproved review source", async ({ fixtures }) => {
    const site = await fixtures.ExternalSiteOrExisting({
      type: "whiskyadvocate",
    });
    const adminUser = await fixtures.User({ admin: true });

    const err = await waitError(
      routerClient.externalSites.triggerJob(
        { site: site.type },
        { context: { user: adminUser } },
      ),
    );

    expect(err).toMatchInlineSnapshot(
      `[Error: External review source whiskyadvocate is not approved for allowFetching.]`,
    );
    expect(pushJob).not.toHaveBeenCalled();
  });
});
