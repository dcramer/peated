import * as Fixtures from "@peated/server/lib/test/fixtures";
import { findBottleId } from "./bottleFinder";

test("findBottle matches exact", async () => {
  const bottle = await Fixtures.Bottle();
  const result = await findBottleId(bottle.fullName);
  expect(result).toBe(bottle.id);
});

test("findBottle matches fullName as prefix", async () => {
  const bottle = await Fixtures.Bottle();
  const result = await findBottleId(bottle.fullName + " Single Grain");
  expect(result).toBe(bottle.id);
});

test("findBottle matches partial fullName", async () => {
  const brand = await Fixtures.Entity({ name: "The Macallan" });
  const bottle = await Fixtures.Bottle({
    brandId: brand.id,
    name: "12-year-old Double Cask",
  });
  const result = await findBottleId("The Macallan 12-year-old");
  expect(result).toBe(bottle.id);
});

test("findBottle doesnt match random junk", async () => {
  const bottle = await Fixtures.Bottle();
  const result = await findBottleId("No Chance");
  expect(result).toBe(null);
});

test("findBottle matches alias", async () => {
  const bottle = await Fixtures.Bottle();
  await Fixtures.BottleAlias({
    bottleId: bottle.id,
    name: "Something Silly",
  });
  const result = await findBottleId("Something Silly");
  expect(result).toBe(bottle.id);
});
