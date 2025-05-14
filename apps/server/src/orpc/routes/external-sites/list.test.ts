import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

describe("GET /external-sites", () => {
  test("lists sites", async ({ fixtures }) => {
    await fixtures.ExternalSite({ type: "whiskyadvocate" });
    await fixtures.ExternalSite({ type: "healthyspirits" });

    const { results } = await routerClient.externalSites.list({});
    expect(results.length).toBe(2);
  });
});
