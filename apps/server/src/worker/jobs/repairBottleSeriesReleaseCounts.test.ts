import { db } from "@peated/server/db";
import { bottleSeries } from "@peated/server/db/schema";
import { checkBottleSeriesReleaseCounts } from "@peated/server/lib/bottleSeriesReleaseCounts";
import { eq } from "drizzle-orm";
import repairBottleSeriesReleaseCountsJob from "./repairBottleSeriesReleaseCounts";

test("repairs wrong counts and is safe to run again", async ({ fixtures }) => {
  const series = await fixtures.BottleSeries({ numReleases: 9 });
  await fixtures.Bottle({ seriesId: series.id });
  await db
    .update(bottleSeries)
    .set({ numReleases: 9 })
    .where(eq(bottleSeries.id, series.id));

  await expect(repairBottleSeriesReleaseCountsJob({})).resolves.toEqual({
    wrongCount: 1,
    repairedCount: 1,
  });
  await expect(checkBottleSeriesReleaseCounts()).resolves.toEqual([]);

  await expect(repairBottleSeriesReleaseCountsJob({})).resolves.toEqual({
    wrongCount: 0,
    repairedCount: 0,
  });
});

test.each([undefined, null, [], { unexpected: true }])(
  "rejects malformed input %#",
  async (input) => {
    // SAFETY: This test bypasses the type so the job can reject invalid queue input.
    await expect(
      repairBottleSeriesReleaseCountsJob(input as never),
    ).rejects.toThrow();
  },
);
