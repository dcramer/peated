import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

describe("GET /external-sites/:type", () => {
  test("get site by type", async ({ fixtures }) => {
    const site = await fixtures.ExternalSite();

    const data = await routerClient.externalSites.details({
      type: site.type,
    });
    expect(data.id).toEqual(site.id);
  });
});
