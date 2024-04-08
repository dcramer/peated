import { createCaller } from "../router";

test("requires admin", async ({ fixtures }) => {
  const site = await fixtures.ExternalSite();
  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
  });
  expect(() =>
    caller.externalSiteUpdate({
      site: site.type,
    }),
  ).rejects.toThrowError(/UNAUTHORIZED/);
});

test("updates site", async ({ fixtures }) => {
  const site = await fixtures.ExternalSite({
    type: "healthyspirits",
  });

  const caller = createCaller({
    user: await fixtures.User({ admin: true }),
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
