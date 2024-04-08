import { createCaller } from "../router";

test("lists prices", async ({ fixtures }) => {
  const bottle = await fixtures.Bottle();
  await fixtures.StorePrice({
    bottleId: bottle.id,
  });

  const caller = createCaller({ user: null });
  const data = await caller.bottlePriceList({
    bottle: bottle.id,
  });

  expect(data.results.length).toBe(1);
});
