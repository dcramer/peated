import { db } from "@peated/server/db";
import { bottles } from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import updateBottleStats from "./updateBottleStats";

test("updates totalTastings", async ({ fixtures }) => {
  const bottle1 = await fixtures.Bottle();
  const bottle2 = await fixtures.Bottle();

  await fixtures.Tasting({ bottleId: bottle1.id });
  await fixtures.Tasting({ bottleId: bottle1.id });
  await fixtures.Tasting({ bottleId: bottle2.id });

  updateBottleStats({ bottleId: bottle1.id });

  const [newBottle1] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, bottle1.id));
  expect(newBottle1).toBeDefined();
  expect(newBottle1.totalTastings).toEqual(2);
});
