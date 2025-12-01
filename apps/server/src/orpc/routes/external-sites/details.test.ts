import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

describe("GET /external-sites/:site", () => {
  test("get site by type", async ({ fixtures }) => {
    const site = await fixtures.ExternalSiteOrExisting();

    const data = await routerClient.externalSites.details({
      site: site.type,
    });
    expect(data.id).toEqual(site.id);
  });
});
