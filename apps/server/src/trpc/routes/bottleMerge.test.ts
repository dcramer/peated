import waitError from "@peated/server/lib/test/waitError";
import { createCaller } from "../router";

test("requires authentication", async () => {
  const caller = createCaller({ user: null });
  const err = await waitError(
    caller.bottleMerge({
      root: 1,
      other: 2,
    }),
  );
  expect(err).toMatchInlineSnapshot(`[TRPCError: UNAUTHORIZED]`);
});

test("requires mod", async ({ fixtures }) => {
  const caller = createCaller({
    user: await fixtures.User({ mod: false, admin: false }),
  });
  const err = await waitError(
    caller.bottleMerge({
      root: 1,
      other: 2,
    }),
  );
  expect(err).toMatchInlineSnapshot(`[TRPCError: UNAUTHORIZED]`);
});

// TODO: test call to pushJob
test("merge A into B", async ({ fixtures }) => {
  const bottleA = await fixtures.Bottle({ totalTastings: 1 });
  await fixtures.Tasting({ bottleId: bottleA.id });
  const bottleB = await fixtures.Bottle();

  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
  });
  const data = await caller.bottleMerge({
    root: bottleA.id,
    other: bottleB.id,
    direction: "mergeInto",
  });

  expect(data.id).toEqual(bottleB.id);
});

// TODO: test call to pushJob
test("merge A from B", async ({ fixtures }) => {
  const bottleA = await fixtures.Bottle({ totalTastings: 1 });
  await fixtures.Tasting({ bottleId: bottleA.id });
  const bottleB = await fixtures.Bottle();

  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
  });
  const data = await caller.bottleMerge({
    root: bottleA.id,
    other: bottleB.id,
    direction: "mergeFrom",
  });

  expect(data.id).toEqual(bottleA.id);
});
