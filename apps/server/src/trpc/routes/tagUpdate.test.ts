import waitError from "@peated/server/lib/test/waitError";
import { createCaller } from "../router";

test("requires mod", async ({ fixtures }) => {
  const tag = await fixtures.Tag();
  const caller = createCaller({
    user: await fixtures.User(),
  });
  const err = await waitError(
    caller.tagUpdate({
      name: tag.name,
    }),
  );
  expect(err).toMatchInlineSnapshot(`[TRPCError: UNAUTHORIZED]`);
});

test("updates tag", async ({ fixtures }) => {
  const tag = await fixtures.Tag({ tagCategory: "peaty" });

  const caller = createCaller({
    user: await fixtures.User({ admin: true }),
  });
  const newTag = await caller.tagUpdate({
    name: tag.name,
    tagCategory: "fruity",
  });

  expect(newTag).toBeDefined();
  expect(newTag.tagCategory).toEqual("fruity");
});
