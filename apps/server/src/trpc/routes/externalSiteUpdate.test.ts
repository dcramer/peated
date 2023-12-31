import * as Fixtures from "../../lib/test/fixtures";
import { createCaller } from "../router";

test("requires admin", async () => {
  const site = await Fixtures.ExternalSite();
  const caller = createCaller({
    user: await Fixtures.User({ mod: true }),
  });
  expect(() =>
    caller.externalSiteUpdate({
      site: site.type,
    }),
  ).rejects.toThrowError(/UNAUTHORIZED/);
});

test("updates site", async () => {
  const site = await Fixtures.ExternalSite({
    type: "healthyspirits",
  });

  const caller = createCaller({
    user: await Fixtures.User({ admin: true }),
  });
  const newSite = await caller.externalSiteUpdate({
    site: site.type,
    name: "Whisky Advocate",
    type: "whiskyadvocate",
    runEvery: 120,
  });

  expect(newSite).toBeDefined();
  expect(newSite.name).toEqual("Whisky Advocate");
  expect(newSite.type).toEqual("whiskyadvocate");
  expect(newSite.runEvery).toEqual(120);
});
