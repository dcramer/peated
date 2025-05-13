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
  expect(results[0].name).toEqual("Foo");
  expect(results[0].isCanonical).toEqual(true);
  expect(results[1].name).toEqual("Foo Bar");
  expect(results[1].isCanonical).toEqual(false);
});
