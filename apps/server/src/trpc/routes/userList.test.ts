import waitError from "@peated/server/lib/test/waitError";
import { createCaller } from "../router";

test("lists entities", async ({ fixtures }) => {
  await fixtures.Entity();
  await fixtures.Entity();

  const caller = createCaller({ user: null });
  const { results } = await caller.entityList();

  expect(results.length).toBe(2);
});

test("lists users needs a query", async ({ defaults, fixtures }) => {
  await fixtures.User();

  const caller = createCaller({ user: defaults.user });
  const { results } = await caller.userList();

  expect(results.length).toBe(0);
});

test("lists users needs a query", async ({ defaults, fixtures }) => {
  const user2 = await fixtures.User({ username: "david.george" });

  const caller = createCaller({ user: defaults.user });
  const { results } = await caller.userList({
    query: "david",
  });

  expect(results.length).toBe(1);
  expect(results[0].id).toBe(user2.id);
});

test("requires authentication", async () => {
  const caller = createCaller({ user: null });
  const err = await waitError(caller.userList());
  expect(err).toMatchInlineSnapshot(`[TRPCError: UNAUTHORIZED]`);
});
