import { createCaller } from "../trpc/router";

test("lists changes", async ({ defaults, fixtures }) => {
  await fixtures.Entity({ name: "Entity 1" });
  await fixtures.Entity({ name: "Entity 2" });

  const caller = createCaller({ user: defaults.user });
  const { results } = await caller.changeList();

  expect(results.length).toBe(2);
});
