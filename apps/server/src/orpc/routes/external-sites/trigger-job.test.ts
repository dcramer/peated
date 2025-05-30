import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { pushJob } from "@peated/server/worker/client";

vi.mock("@peated/server/worker/client");

describe("POST /external-sites/:site/trigger", () => {
  test("requires admin", async ({ fixtures }) => {
    const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });
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
    const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });
    const adminUser = await fixtures.User({ admin: true });

    const result = await routerClient.externalSites.triggerJob(
      { site: site.type },
      { context: { user: adminUser } },
    );

    expect(result.success).toBe(true);
    expect(pushJob).toHaveBeenCalledOnce();
  });
});
