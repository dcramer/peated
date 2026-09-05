import { db } from "@peated/server/db";
import { collectionBottles, collections } from "@peated/server/db/schema";
import { checkCollectionBottleCounts } from "@peated/server/lib/collectionBottleCounts";
import { eq } from "drizzle-orm";
import repairCollectionBottleCountsJob from "./repairCollectionBottleCounts";

test("repairs wrong counts and is safe to run again", async ({
  defaults,
  fixtures,
}) => {
  const collection = await fixtures.Collection({
    createdById: defaults.user.id,
    totalBottles: 9,
  });
  const bottle = await fixtures.Bottle();
  await db.insert(collectionBottles).values({
    collectionId: collection.id,
    bottleId: bottle.id,
  });
  await db
    .update(collections)
    .set({ totalBottles: 9 })
    .where(eq(collections.id, collection.id));

  await expect(repairCollectionBottleCountsJob({})).resolves.toEqual({
    wrongCount: 1,
    repairedCount: 1,
  });
  await expect(checkCollectionBottleCounts()).resolves.toEqual([]);

  await expect(repairCollectionBottleCountsJob({})).resolves.toEqual({
    wrongCount: 0,
    repairedCount: 0,
  });
});

test.each([undefined, null, [], { unexpected: true }])(
  "rejects malformed input %#",
  async (input) => {
    // SAFETY: This test bypasses the type so the job can reject invalid queue input.
    await expect(
      repairCollectionBottleCountsJob(input as never),
    ).rejects.toThrow();
  },
);
