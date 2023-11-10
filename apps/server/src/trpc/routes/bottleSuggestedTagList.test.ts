import * as Fixtures from "../../lib/test/fixtures";
import { appRouter } from "../router";

test("lists tags", async () => {
  const bottle = await Fixtures.Bottle();
  const bottle2 = await Fixtures.Bottle({
    brandId: bottle.brandId,
  });
  await Fixtures.Tasting({
    bottleId: bottle.id,
    tags: ["solvent", "caramel"],
    rating: 5,
  });
  await Fixtures.Tasting({
    bottleId: bottle.id,
    tags: ["cedar", "caramel"],
    rating: 5,
  });
  await Fixtures.Tasting({
    bottleId: bottle2.id,
    tags: ["cedar", "caramel"],
    rating: 5,
  });

  const caller = appRouter.createCaller({ user: null });
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
