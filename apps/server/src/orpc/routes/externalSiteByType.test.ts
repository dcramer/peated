import { describe, expect, test } from "vitest";
import { routerClient } from "../router";

describe("GET /external-sites/:type", () => {
  test("get site by type", async ({ fixtures }) => {
    const site = await fixtures.ExternalSite();

    const data = await routerClient.externalSiteByType({
      type: site.type,
    });
    expect(data.id).toEqual(site.id);
  });
});
