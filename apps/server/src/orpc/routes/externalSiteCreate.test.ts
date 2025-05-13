import waitError from "@peated/server/lib/test/waitError";
import { createCaller } from "../router";

test("requires admin", async ({ fixtures }) => {
  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
  });
  const err = await waitError(
    caller.externalSiteCreate({
      name: "Whisky Advocate",
      type: "whiskyadvocate",
    }),
  );
  expect(err).toMatchInlineSnapshot(`[TRPCError: UNAUTHORIZED]`);
});

test("triggers job", async ({ fixtures }) => {
  const caller = createCaller({
    user: await fixtures.User({ admin: true }),
  });
  const newSite = await caller.externalSiteCreate({
    name: "Whisky Advocate",
    type: "whiskyadvocate",
  });

  expect(newSite.name).toEqual("Whisky Advocate");
  expect(newSite.type).toEqual("whiskyadvocate");
  expect(newSite.runEvery).toBeNull();
});
