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
  expect(results).toMatchInlineSnapshot(`
    [
      {
        "isCanonical": true,
        "name": "Brand Foo",
      },
      {
        "isCanonical": false,
        "name": "Foo Bar",
      },
    ]
  `);
});
