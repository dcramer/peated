import waitError from "@peated/server/lib/test/waitError";
import { pushJob } from "@peated/server/worker/client";
import { routerClient } from "../router";

vi.mock("@peated/server/worker/client");

describe("POST /external-sites/:site/trigger", () => {
  test("requires admin", async ({ fixtures }) => {
    const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });
    const modUser = await fixtures.User({ mod: true });

    const err = await waitError(
      routerClient.externalSiteTriggerJob(
        { site: site.type },
        { context: { user: modUser } },
      ),
    );
    expect(err).toMatchInlineSnapshot();
  });

  test("triggers job", async ({ fixtures }) => {
    const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });
    const adminUser = await fixtures.User({ admin: true });

    const result = await routerClient.externalSiteTriggerJob(
      { site: site.type },
      { context: { user: adminUser } },
    );

    expect(result.success).toBe(true);
    expect(pushJob).toHaveBeenCalledOnce();
  });
});
