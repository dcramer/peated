import { db } from "@peated/server/db";
import { entities } from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import updateEntityStats from "./updateEntityStats";

test("updates totalBottles", async ({ fixtures }) => {
  const entity1 = await fixtures.Entity({ name: "A" });
  const entity2 = await fixtures.Entity({ name: "B" });
  const entity3 = await fixtures.Entity({ name: "C" });

  await fixtures.Bottle({ brandId: entity1.id, name: "A" });
  await fixtures.Bottle({
    brandId: entity2.id,
    name: "B",
    bottlerId: entity1.id,
  });
  await fixtures.Bottle({ brandId: entity3.id, name: "C" });
  await fixtures.Bottle({ distillerIds: [entity1.id, entity2.id], name: "D" });

  await updateEntityStats({ entityId: entity1.id });

  const [newEntity1] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, entity1.id));
  expect(newEntity1).toBeDefined();
  expect(newEntity1.totalBottles).toEqual(3);
});
