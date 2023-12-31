import * as Fixtures from "../../lib/test/fixtures";
import { createCaller } from "../router";

test("lists bottle aliases", async () => {
  const bottle = await Fixtures.Bottle();
  await Fixtures.BottleAlias({
    bottleId: bottle.id,
    name: "Foo Bar",
  });

  const caller = createCaller({
    user: null,
  });
  const { results } = await caller.bottleAliasList({
    bottle: bottle.id,
  });
  expect(results.length).toBe(2);
});
