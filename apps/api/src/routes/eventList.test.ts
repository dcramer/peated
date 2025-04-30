import { createCaller } from "../trpc/router";

test("lists events", async ({ fixtures }) => {
  await fixtures.Event();
  await fixtures.Event();

  const caller = createCaller({
    user: null,
  });
  const { results } = await caller.eventList({
    onlyUpcoming: false,
  });
  expect(results.length).toBe(2);
});
