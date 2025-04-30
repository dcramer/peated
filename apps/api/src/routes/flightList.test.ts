import { createCaller } from "../trpc/router";

test("lists flights", async ({ defaults, fixtures }) => {
  const flight1 = await fixtures.Flight({
    createdById: defaults.user.id,
  });
  await fixtures.Flight();

  const caller = createCaller({ user: defaults.user });
  const { results } = await caller.flightList();

  expect(results.length).toBe(1);
  expect(results[0].id).toBe(flight1.publicId);
});
