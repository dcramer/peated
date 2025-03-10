import { createCaller } from "../router";

test("lists tags", async ({ fixtures }) => {
  const bottle = await fixtures.Bottle({
    name: "A",
  });
  const bottle2 = await fixtures.Bottle({
    name: "B",
    brandId: bottle.brandId,
  });
  await fixtures.Tasting({
    bottleId: bottle.id,
    tags: ["solvent", "caramel"],
    rating: 5,
  });
  await fixtures.Tasting({
    bottleId: bottle.id,
    tags: ["caramel"],
    rating: 5,
  });
  await fixtures.Tasting({
    bottleId: bottle2.id,
    tags: ["cedar", "caramel"],
    rating: 5,
  });

  const caller = createCaller({ user: null });
  const { results, totalCount } = await caller.bottleTagList({
    bottle: bottle.id,
  });

  expect(totalCount).toEqual(2);
  expect(results).toEqual([
    { tag: "caramel", count: 2 },
    { tag: "solvent", count: 1 },
  ]);
});
