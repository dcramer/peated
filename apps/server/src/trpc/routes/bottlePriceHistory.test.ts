import { createCaller } from "../router";

test("lists bottle history", async ({ fixtures }) => {
  const bottle = await fixtures.Bottle();
  await fixtures.StorePrice({
    bottleId: bottle.id,
  });

  const caller = createCaller({ user: null });
  const { results } = await caller.bottlePriceHistory({
    bottle: bottle.id,
  });

  expect(results.length).toBe(1);
});
