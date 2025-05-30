import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";

describe("PATCH /external-sites/:site", () => {
  test("requires admin", async ({ fixtures }) => {
    const site = await fixtures.ExternalSite();
    const modUser = await fixtures.User({ mod: true });

    const err = await waitError(
      routerClient.externalSites.update(
        {
          site: site.type,
        },
        { context: { user: modUser } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("updates site", async ({ fixtures }) => {
    const site = await fixtures.ExternalSite({
      type: "healthyspirits",
    });
    const adminUser = await fixtures.User({ admin: true });

    const newSite = await routerClient.externalSites.update(
      {
        site: site.type,
        name: "Whisky Advocate",
        type: "whiskyadvocate",
        runEvery: 120,
      },
      { context: { user: adminUser } },
    );

    expect(newSite).toBeDefined();
    expect(newSite.name).toEqual("Whisky Advocate");
    expect(newSite.type).toEqual("whiskyadvocate");
    expect(newSite.runEvery).toEqual(120);
  });
});
