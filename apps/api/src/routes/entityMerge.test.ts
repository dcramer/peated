import waitError from "@peated/server/lib/test/waitError";
import { createCaller } from "../trpc/router";

test("requires authentication", async () => {
  const caller = createCaller({ user: null });
  const err = await waitError(
    caller.entityMerge({
      root: 1,
      other: 2,
    }),
  );
  expect(err).toMatchInlineSnapshot(`[TRPCError: UNAUTHORIZED]`);
});

test("requires mod", async ({ defaults }) => {
  const caller = createCaller({ user: defaults.user });
  const err = await waitError(
    caller.entityMerge({
      root: 1,
      other: 2,
    }),
  );
  expect(err).toMatchInlineSnapshot(`[TRPCError: UNAUTHORIZED]`);
});

// TODO: test call to pushJob
test("merge A into B", async ({ fixtures }) => {
  const entityA = await fixtures.Entity({ totalTastings: 1, totalBottles: 2 });
  const entityB = await fixtures.Entity({ totalTastings: 3, totalBottles: 1 });

  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
  });
  const data = await caller.entityMerge({
    root: entityA.id,
    other: entityB.id,
    direction: "mergeInto",
  });

  expect(data.id).toEqual(entityB.id);
});

// TODO: test call to pushJob
test("merge A from B", async ({ fixtures }) => {
  const entityA = await fixtures.Entity({ totalTastings: 1, totalBottles: 2 });
  const entityB = await fixtures.Entity({ totalTastings: 3, totalBottles: 1 });

  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
  });
  const data = await caller.entityMerge({
    root: entityA.id,
    other: entityB.id,
    direction: "mergeFrom",
  });

  expect(data.id).toEqual(entityA.id);
});
