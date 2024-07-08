import { createCaller } from "../router";

test("lists bottle aliases", async ({ fixtures }) => {
  const brand = await fixtures.Entity({ name: "Brand" });
  const bottle = await fixtures.Bottle({ name: "Foo", brandId: brand.id });
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
  expect(results.length).toEqual(2);
  expect(results[0].name).toEqual("Brand Foo");
  expect(results[0].isCanonical).toEqual(true);
  expect(results[1].name).toEqual("Foo Bar");
  expect(results[1].isCanonical).toEqual(false);
});
