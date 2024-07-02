import { db } from "@peated/server/db";
import { entities } from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import updateEntityStats from "./updateEntityStats";

test("updates totalBottles", async ({ fixtures }) => {
  const entity1 = await fixtures.Entity();
  const entity2 = await fixtures.Entity();
  const entity3 = await fixtures.Entity();

  await fixtures.Bottle({ brandId: entity1.id });
  await fixtures.Bottle({ brandId: entity2.id, bottlerId: entity1.id });
  await fixtures.Bottle({ brandId: entity3.id });
  await fixtures.Bottle({ distillerIds: [entity1.id, entity2.id] });

  updateEntityStats({ entityId: entity1.id });

  const [newEntity1] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, entity1.id));
  expect(newEntity1).toBeDefined();
  expect(newEntity1.totalBottles).toEqual(3);
});
