import * as Fixtures from "../../lib/test/fixtures";
import { appRouter } from "../router";

test("get site by type", async () => {
  const site = await Fixtures.ExternalSite();

  const caller = appRouter.createCaller({ user: null });
  const data = await caller.externalSiteByType(site.type);
  expect(data.id).toEqual(site.id);
});
