import { createCaller } from "../router";

test("lists tags", async ({ fixtures }) => {
  const bottle = await fixtures.Bottle();
  const bottle2 = await fixtures.Bottle({
    brandId: bottle.brandId,
  });

  const tagSolvent = await fixtures.Tag({ name: "solvent" });
  const tagCaramel = await fixtures.Tag({ name: "caramel" });
  const tagCedar = await fixtures.Tag({ name: "cedar" });

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
  expect(results[0].tag.name).toEqual("caramel");
  expect(results[0].count).toEqual(3);
  expect(results[1].tag.name).toEqual("cedar");
  expect(results[1].count).toEqual(2);
  expect(results[2].tag.name).toEqual("solvent");
  expect(results[2].count).toEqual(1);
});
