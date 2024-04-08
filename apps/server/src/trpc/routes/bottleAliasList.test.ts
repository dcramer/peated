import { createCaller } from "../router";

test("lists bottle aliases", async ({ fixtures }) => {
  const bottle = await fixtures.Bottle();
  await fixtures.BottleAlias({
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
