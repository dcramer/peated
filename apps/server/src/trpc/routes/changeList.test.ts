import { createCaller } from "../router";

test("lists changes", async ({ defaults, fixtures }) => {
  await fixtures.Entity();
  await fixtures.Entity();

  const caller = createCaller({ user: defaults.user });
  const { results } = await caller.changeList();

  expect(results.length).toBe(2);
});
