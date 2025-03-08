import { db } from "@peated/server/db";
import { regions } from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import updateRegionStats from "./updateRegionStats";

test("updates totalBottles", async ({ fixtures }) => {
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

  await fixtures.Bottle({ brandId: entity1.id });
  await fixtures.Bottle({ brandId: entity2.id, bottlerId: entity1.id });
  await fixtures.Bottle({ brandId: entity3.id });
  await fixtures.Bottle({ distillerIds: [entity1.id, entity2.id] });

  await updateRegionStats({ regionId: region1.id });

  const [newRegion1] = await db
    .select()
    .from(regions)
    .where(eq(regions.id, region1.id));
  expect(newRegion1).toBeDefined();
  expect(newRegion1.totalBottles).toEqual(3);
});
