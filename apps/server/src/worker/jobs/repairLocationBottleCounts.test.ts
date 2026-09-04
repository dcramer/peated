import { db } from "@peated/server/db";
import { countries, regions } from "@peated/server/db/schema";
import { checkLocationBottleCounts } from "@peated/server/lib/locationBottleCounts";
import { eq } from "drizzle-orm";
import repairLocationBottleCountsJob from "./repairLocationBottleCounts";

test("repairs wrong counts and is safe to run again", async ({ fixtures }) => {
  const country = await fixtures.Country({ totalBottles: 0 });
  const region = await fixtures.Region({
    countryId: country.id,
    totalBottles: 0,
  });
  const distillery = await fixtures.Entity({
    countryId: country.id,
    regionId: region.id,
  });
  await fixtures.Bottle({ distillerIds: [distillery.id] });
  await db
    .update(countries)
    .set({ totalBottles: 9 })
    .where(eq(countries.id, country.id));
  await db
    .update(regions)
    .set({ totalBottles: 8 })
    .where(eq(regions.id, region.id));

  await expect(repairLocationBottleCountsJob({})).resolves.toEqual({
    wrongCount: 2,
    repairedCount: 2,
  });
  await expect(checkLocationBottleCounts()).resolves.toEqual([]);

  await expect(repairLocationBottleCountsJob({})).resolves.toEqual({
    wrongCount: 0,
    repairedCount: 0,
  });
});

test.each([undefined, null, [], { unexpected: true }])(
  "rejects malformed input %#",
  async (input) => {
    // SAFETY: This test bypasses the type so the job can reject invalid queue input.
    await expect(
      repairLocationBottleCountsJob(input as never),
    ).rejects.toThrow();
  },
);
