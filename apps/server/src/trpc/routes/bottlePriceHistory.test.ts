import * as Fixtures from "../../lib/test/fixtures";
import { appRouter } from "../router";

test("lists bottle history", async () => {
  const bottle = await Fixtures.Bottle();
  await Fixtures.StorePrice({
    bottleId: bottle.id,
  });

  const caller = appRouter.createCaller({ user: null });
  const { results } = await caller.bottlePriceHistory({
    bottle: bottle.id,
  });

  expect(results.length).toBe(1);
});
