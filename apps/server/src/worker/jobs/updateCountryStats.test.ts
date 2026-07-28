import { db } from "@peated/server/db";
import {
  bottleGroupTombstones,
  bottleTombstones,
  countries,
} from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import updateCountryStats from "./updateCountryStats";

test("counts active independently complete Bottles once", async ({
  fixtures,
}) => {
  const country1 = await fixtures.Country({ name: "United States" });
  const country2 = await fixtures.Country({ name: "Canada" });

  const entity1 = await fixtures.Entity({ name: "A", countryId: country1.id });
  const entity2 = await fixtures.Entity({ name: "B", countryId: country1.id });
  const entity3 = await fixtures.Entity({ name: "C", countryId: country2.id });

  await fixtures.Bottle({ name: "A", brandId: entity1.id });
  await fixtures.Bottle({
    name: "B",
    brandId: entity2.id,
    bottlerId: entity1.id,
  });
  await fixtures.Bottle({ name: "C", brandId: entity3.id });
  await fixtures.Bottle({ name: "D", distillerIds: [entity1.id, entity2.id] });
  await fixtures.LegacyBottle({
    name: "Unmigrated Country Bottle",
    brandId: entity1.id,
  });
  const retiredBottle = await fixtures.Bottle({
    name: "Retired Country Bottle",
    brandId: entity1.id,
  });
  const retiredGroupBottle = await fixtures.Bottle({
    name: "Retired Country Group Bottle",
    brandId: entity1.id,
  });
  const replacementGroupBottle = await fixtures.Bottle({
    name: "Replacement Country Group Bottle",
    brandId: entity3.id,
  });
  await db.insert(bottleTombstones).values({
    bottleId: retiredBottle.id,
    newBottleId: null,
  });
  await db.insert(bottleGroupTombstones).values({
    groupId: retiredGroupBottle.groupId!,
    newGroupId: replacementGroupBottle.groupId!,
    createdByActorId: retiredGroupBottle.createdByActorId,
  });

  await updateCountryStats({ countryId: country1.id });

  const [newCountry1] = await db
    .select()
    .from(countries)
    .where(eq(countries.id, country1.id));
  expect(newCountry1).toBeDefined();
  expect(newCountry1.totalBottles).toEqual(3);
});

test.each([
  undefined,
  {},
  { countryId: 0 },
  { countryId: 1.5 },
  { countryId: "1" },
  { countryId: 1, releaseId: 2 },
])("rejects malformed job input %#", async (input) => {
  await expect(updateCountryStats(input)).rejects.toThrow();
});
