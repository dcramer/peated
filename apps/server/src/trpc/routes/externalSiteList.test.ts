import * as Fixtures from "../../lib/test/fixtures";
import { appRouter } from "../router";

test("lists sites", async () => {
  await Fixtures.ExternalSite({ type: "whiskyadvocate" });
  await Fixtures.ExternalSite({ type: "healthyspirits" });

  const caller = appRouter.createCaller({
    user: null,
  });
  const { results } = await caller.externalSiteList();
  expect(results.length).toBe(2);
});
