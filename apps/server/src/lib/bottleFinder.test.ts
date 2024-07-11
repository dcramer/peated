import { findBottleId, findEntity } from "./bottleFinder";

test("findBottle matches exact", async ({ fixtures }) => {
  const bottle = await fixtures.Bottle();
  const result = await findBottleId(bottle.fullName);
  expect(result).toBe(bottle.id);
});

test("findBottle matches fullName as prefix", async ({ fixtures }) => {
  const bottle = await fixtures.Bottle();
  const result = await findBottleId(bottle.fullName + " Single Grain");
  expect(result).toBe(bottle.id);
});

test("findBottle matches partial fullName", async ({ fixtures }) => {
  const brand = await fixtures.Entity({ name: "The Macallan" });
  const bottle = await fixtures.Bottle({
    brandId: brand.id,
    name: "12-year-old Double Cask",
  });
  const result = await findBottleId("The Macallan 12-year-old");
  expect(result).toBe(bottle.id);
});

test("findBottle doesnt match random junk", async ({ fixtures }) => {
  await fixtures.Bottle();
  const result = await findBottleId("No Chance");
  expect(result).toBe(null);
});

test("findBottle matches alias", async ({ fixtures }) => {
  const bottle = await fixtures.Bottle();
  await fixtures.BottleAlias({
    bottleId: bottle.id,
    name: "Something Silly",
  });
  const result = await findBottleId("Something Silly");
  expect(result).toBe(bottle.id);
});

test("findBottle prioritizes correct prefix", async ({ fixtures }) => {
  const entity = await fixtures.Entity({ name: "Aberfeldy" });
  const bottle = await fixtures.Bottle({
    brandId: entity.id,
    name: "18-year-old",
  });
  const bottle2 = await fixtures.Bottle({
    brandId: entity.id,
    name: "18-year-old Port Cask",
  });
  const result = await findBottleId("Aberfeldy 18-year-old Port Cask");
  expect(result).toBe(bottle2.id);

  const result2 = await findBottleId("Aberfeldy 18-year-old");
  expect(result2).toBe(bottle.id);
});

test("findEntity matches exact", async ({ fixtures }) => {
  const entity = await fixtures.Entity({ name: "Hibiki" });
  const result = await findEntity("Hibiki");
  expect(result?.id).toEqual(entity.id);
});

test("findEntity matches bottle name prefix", async ({ fixtures }) => {
  const entity = await fixtures.Entity({ name: "Hibiki" });
  const result = await findEntity("Hibiki 12-year-old");
  expect(result?.id).toEqual(entity.id);
});

test("findEntity does not match entity name prefix", async ({ fixtures }) => {
  await fixtures.Entity({ name: "Hibiki Real" });
  const result = await findEntity("Hibiki 12-year-old");
  expect(result).toBeNull();

  await findEntity("The Hibiki Real 12-year-old");
  expect(result).toBeNull();
});
