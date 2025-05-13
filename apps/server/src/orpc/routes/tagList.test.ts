import { createCaller } from "../router";

test("lists tags", async ({ fixtures }) => {
  await fixtures.Tag({ name: "a" });
  await fixtures.Tag({ name: "b" });

  const caller = createCaller({ user: null });
  const { results } = await caller.tagList();

  expect(results.length).toBe(2);
  expect(results[0].name).toEqual("a");
  expect(results[1].name).toEqual("b");
});
