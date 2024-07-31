import { createCaller } from "../router";

test("lists events", async ({ fixtures }) => {
  await fixtures.Event();
  await fixtures.Event();

  const caller = createCaller({
    user: null,
  });
  const { results } = await caller.eventList();
  expect(results.length).toBe(2);
});
