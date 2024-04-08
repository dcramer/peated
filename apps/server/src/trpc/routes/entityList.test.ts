import { createCaller } from "../router";

test("lists entities", async ({ fixtures }) => {
  await fixtures.Entity();
  await fixtures.Entity();

  const caller = createCaller({ user: null });
  const { results } = await caller.entityList();

  expect(results.length).toBe(2);
});
