import { createCaller } from "../router";

test("lists reviews", async ({ fixtures }) => {
  await fixtures.Review();
  await fixtures.Review();

  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
  });
  const { results } = await caller.reviewList();

  expect(results.length).toBe(2);
});

test("lists tags", async ({ fixtures }) => {
  await fixtures.Tag({ name: "a" });
  await fixtures.Tag({ name: "b" });

  const caller = createCaller({ user: null });
  const { results } = await caller.tagList();

  expect(results.length).toBe(2);
  expect(results[0].name).toEqual("a");
  expect(results[1].name).toEqual("b");
});
