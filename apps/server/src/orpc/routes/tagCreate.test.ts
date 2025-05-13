import waitError from "@peated/server/lib/test/waitError";
import { createCaller } from "../router";

test("requires mod", async ({ fixtures }) => {
  const caller = createCaller({
    user: await fixtures.User(),
  });
  const err = await waitError(
    caller.tagCreate({
      name: "Peated",
      tagCategory: "peaty",
    }),
  );
  expect(err).toMatchInlineSnapshot(`[TRPCError: UNAUTHORIZED]`);
});

test("triggers job", async ({ fixtures }) => {
  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
  });
  const tag = await caller.tagCreate({
    name: "Peated",
    tagCategory: "peaty",
  });

  expect(tag.name).toEqual("peated");
  expect(tag.tagCategory).toEqual("peaty");
});
