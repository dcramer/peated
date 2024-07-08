import { createCaller } from "../router";

test("lists entity aliases", async ({ fixtures }) => {
  const entity = await fixtures.Entity({ name: "Foo" });
  await fixtures.EntityAlias({
    entityId: entity.id,
    name: "Foo Bar",
  });

  const caller = createCaller({
    user: null,
  });
  const { results } = await caller.entityAliasList({
    entity: entity.id,
  });
  expect(results.length).toEqual(2);
  expect(results).toMatchInlineSnapshot(`
    [
      {
        "isCanonical": true,
        "name": "Foo",
      },
      {
        "isCanonical": false,
        "name": "Foo Bar",
      },
    ]
  `);
});
