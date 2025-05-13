import { createCaller } from "../router";

test("get site by type", async ({ fixtures }) => {
  const site = await fixtures.ExternalSite();

  const caller = createCaller({ user: null });
  const data = await caller.externalSiteByType(site.type);
  expect(data.id).toEqual(site.id);
});
