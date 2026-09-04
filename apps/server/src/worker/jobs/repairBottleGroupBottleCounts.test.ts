import { db } from "@peated/server/db";
import { bottleGroups } from "@peated/server/db/schema";
import { checkBottleGroupBottleCounts } from "@peated/server/lib/recomputeBottleGroupStats";
import { eq } from "drizzle-orm";
import repairBottleGroupBottleCountsJob from "./repairBottleGroupBottleCounts";

test("repairs wrong counts and is safe to run again", async ({ fixtures }) => {
  const bottle = await fixtures.Bottle();
  await fixtures.BottleGroupMember({ groupId: bottle.groupId });
  await db
    .update(bottleGroups)
    .set({ totalBottles: 9 })
    .where(eq(bottleGroups.id, bottle.groupId));

  await expect(repairBottleGroupBottleCountsJob({})).resolves.toEqual({
    wrongCount: 1,
    repairedCount: 1,
  });
  await expect(checkBottleGroupBottleCounts()).resolves.toEqual([]);

  await expect(repairBottleGroupBottleCountsJob({})).resolves.toEqual({
    wrongCount: 0,
    repairedCount: 0,
  });
});

test.each([undefined, null, [], { unexpected: true }])(
  "rejects malformed input %#",
  async (input) => {
    // SAFETY: This test bypasses the type so the job can reject invalid queue input.
    await expect(
      repairBottleGroupBottleCountsJob(input as never),
    ).rejects.toThrow();
  },
);
