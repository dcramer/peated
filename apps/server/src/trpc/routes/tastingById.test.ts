import { createCaller } from "../router";

test("get tasting by id", async ({ fixtures }) => {
  const tasting = await fixtures.Tasting();

  const caller = createCaller({ user: null });
  const data = await caller.tastingById(tasting.id);
  expect(data.id).toEqual(tasting.id);
});

test("errors on invalid tasting", async () => {
  const caller = createCaller({ user: null });
  expect(() => caller.tastingById(1)).rejects.toThrowError(/NOT_FOUND/);
});
