import waitError from "@peated/server/lib/test/waitError";
import { createCaller } from "../router";

test("requires admin", async ({ fixtures }) => {
  const site = await fixtures.ExternalSite();
  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
  });
  const err = await waitError(
    caller.externalSiteUpdate({
      site: site.type,
    }),
  );
  expect(err).toMatchInlineSnapshot();
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
