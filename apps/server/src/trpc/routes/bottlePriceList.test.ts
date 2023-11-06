import * as Fixtures from "../../lib/test/fixtures";
import { appRouter } from "../router";

test("lists prices", async () => {
  const bottle = await Fixtures.Bottle();
  await Fixtures.StorePrice({
    bottleId: bottle.id,
  });

  const caller = appRouter.createCaller({ user: null });
  const data = await caller.bottlePriceList({
    bottle: bottle.id,
  });

  expect(data.results.length).toBe(1);
});
