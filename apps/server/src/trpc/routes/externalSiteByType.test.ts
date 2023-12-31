import * as Fixtures from "../../lib/test/fixtures";
import { createCaller } from "../router";

test("get site by type", async () => {
  const site = await Fixtures.ExternalSite();

  const caller = createCaller({ user: null });
  const data = await caller.externalSiteByType(site.type);
  expect(data.id).toEqual(site.id);
});
