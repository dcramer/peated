import { createCaller } from "../router";

test("lists badges", async ({ fixtures }) => {
  await fixtures.Badge();
  await fixtures.Badge();

  const caller = createCaller({
    user: null,
  });
  const { results } = await caller.badgeList();
  expect(results.length).toBe(2);
});
