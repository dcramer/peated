import * as Fixtures from "../../lib/test/fixtures";
import { appRouter } from "../router";

test("requires admin", async () => {
  const caller = appRouter.createCaller({
    user: await Fixtures.User({ mod: true }),
  });
  expect(() =>
    caller.externalSiteCreate({
      name: "Whisky Advocate",
      type: "whiskyadvocate",
    }),
  ).rejects.toThrowError(/UNAUTHORIZED/);
});

test("triggers job", async () => {
  const caller = appRouter.createCaller({
    user: await Fixtures.User({ admin: true }),
  });
  const newSite = await caller.externalSiteCreate({
    name: "Whisky Advocate",
    type: "whiskyadvocate",
  });

  expect(newSite.name).toEqual("Whisky Advocate");
  expect(newSite.type).toEqual("whiskyadvocate");
  expect(newSite.runEvery).toBeNull();
});
