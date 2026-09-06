import { db } from "@peated/server/db";
import { bottleTombstones } from "@peated/server/db/schema";
import { pushUniqueJob } from "@peated/server/lib/test/workerDispatch";
import { beforeEach, describe, expect, test, vi } from "vitest";
import repairBottleStatsJob from "./repairBottleStats";

describe("RepairBottleStats", () => {
  beforeEach(() => {
    vi.mocked(pushUniqueJob).mockReset().mockResolvedValue(undefined);
  });

  test("queues each active grouped Bottle once", async ({ fixtures }) => {
    const active = await fixtures.Bottle();
    const retired = await fixtures.Bottle();
    const replacement = await fixtures.Bottle();
    await fixtures.LegacyBottle();
    await db.insert(bottleTombstones).values({
      bottleId: retired.id,
      newBottleId: replacement.id,
    });

    await expect(repairBottleStatsJob({})).resolves.toEqual({
      lastBottleId: replacement.id,
      queuedCount: 2,
    });
    expect(pushUniqueJob).toHaveBeenCalledTimes(2);
    for (const bottle of [active, replacement]) {
      expect(pushUniqueJob).toHaveBeenCalledWith(
        "UpdateBottleStats",
        { bottleId: bottle.id },
        { delay: 0, removeOnComplete: true, removeOnFail: false },
      );
    }
  });
});
