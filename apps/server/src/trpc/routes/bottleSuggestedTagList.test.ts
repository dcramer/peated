import { createCaller } from "../router";

test("lists tags", async ({ fixtures }) => {
  const bottle = await fixtures.Bottle();
  const bottle2 = await fixtures.Bottle({
    brandId: bottle.brandId,
  });
  await fixtures.Tasting({
    bottleId: bottle.id,
    tags: ["solvent", "caramel"],
    rating: 5,
  });
  await fixtures.Tasting({
    bottleId: bottle.id,
    tags: ["cedar", "caramel"],
    rating: 5,
  });
  await fixtures.Tasting({
    bottleId: bottle2.id,
    tags: ["cedar", "caramel"],
    rating: 5,
  });

  const caller = createCaller({ user: null });
  const { results } = await caller.bottleSuggestedTagList({
    bottle: bottle.id,
  });

  expect(results.length).toBeGreaterThan(3);
  expect(results.slice(0, 3)).toEqual([
    { tag: "caramel", count: 3 },
    { tag: "cedar", count: 2 },
    { tag: "solvent", count: 1 },
  ]);
});
