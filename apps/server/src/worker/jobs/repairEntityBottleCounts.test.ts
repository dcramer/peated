import { db } from "@peated/server/db";
import { entities } from "@peated/server/db/schema";
import { checkEntityBottleCounts } from "@peated/server/lib/entityBottleCounts";
import { eq } from "drizzle-orm";
import repairEntityBottleCountsJob from "./repairEntityBottleCounts";

test("repairs wrong counts and is safe to run again", async ({ fixtures }) => {
  const wrong = await fixtures.Entity();
  const correct = await fixtures.Entity();
  await fixtures.Bottle({ brandId: wrong.id });
  await db
    .update(entities)
    .set({ totalBottles: 9 })
    .where(eq(entities.id, wrong.id));

  await expect(repairEntityBottleCountsJob({})).resolves.toEqual({
    wrongCount: 1,
    repairedCount: 1,
  });
  await expect(
    checkEntityBottleCounts([wrong.id, correct.id]),
  ).resolves.toEqual([]);

  await expect(repairEntityBottleCountsJob({})).resolves.toEqual({
    wrongCount: 0,
    repairedCount: 0,
  });
});

test.each([undefined, null, [], { unexpected: true }])(
  "rejects malformed input %#",
  async (input) => {
    // SAFETY: The test deliberately passes invalid queue input through the runtime boundary.
    await expect(repairEntityBottleCountsJob(input as never)).rejects.toThrow();
  },
);
