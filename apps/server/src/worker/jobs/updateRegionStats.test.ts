import { db } from "@peated/server/db";
import {
  bottleGroupTombstones,
  bottleTombstones,
  regions,
} from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import updateRegionStats from "./updateRegionStats";

test("counts active independently complete Bottles once", async ({
  fixtures,
}) => {
  const region1 = await fixtures.Region({ name: "Region 1" });
  const region2 = await fixtures.Region({ name: "Region 2" });

  const entity1 = await fixtures.Entity({
    name: "Entity 1",
    regionId: region1.id,
  });
  const entity2 = await fixtures.Entity({
    name: "Entity 2",
    regionId: region1.id,
  });
  const entity3 = await fixtures.Entity({
    name: "Entity 3",
    regionId: region2.id,
  });

  await fixtures.Bottle({ name: "Bottle 1", brandId: entity1.id });
  await fixtures.Bottle({
    name: "Bottle 2",
    brandId: entity2.id,
    bottlerId: entity1.id,
  });
  await fixtures.Bottle({ name: "Bottle 3", brandId: entity3.id });
  await fixtures.Bottle({
    name: "Bottle 4",
    distillerIds: [entity1.id, entity2.id],
  });
  await fixtures.LegacyBottle({
    name: "Unmigrated Region Bottle",
    brandId: entity1.id,
  });
  const retiredBottle = await fixtures.Bottle({
    name: "Retired Region Bottle",
    brandId: entity1.id,
  });
  const retiredGroupBottle = await fixtures.Bottle({
    name: "Retired Region Group Bottle",
    brandId: entity1.id,
  });
  const replacementGroupBottle = await fixtures.Bottle({
    name: "Replacement Region Group Bottle",
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

  await updateRegionStats({ regionId: region1.id });

  const [newRegion1] = await db
    .select()
    .from(regions)
    .where(eq(regions.id, region1.id));
  expect(newRegion1).toBeDefined();
  expect(newRegion1.totalBottles).toEqual(3);
});

test.each([
  undefined,
  {},
  { regionId: 0 },
  { regionId: 1.5 },
  { regionId: "1" },
  { regionId: 1, targetId: 2 },
])("rejects malformed job input %#", async (input) => {
  await expect(updateRegionStats(input)).rejects.toThrow();
});
