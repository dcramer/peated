import { createCaller } from "../trpc/router";

test("lists sites", async ({ fixtures }) => {
  await fixtures.ExternalSite({ type: "whiskyadvocate" });
  await fixtures.ExternalSite({ type: "healthyspirits" });

  const caller = createCaller({
    user: null,
  });
  const { results } = await caller.externalSiteList();
  expect(results.length).toBe(2);
});
