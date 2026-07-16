import { db } from "@peated/server/db";
import { notEmpty, uniq } from "@peated/server/lib/filter";
import { pushJob } from "@peated/server/worker/client";

/**
 * Queue legacy entity refreshes from the supplied concrete Bottle. Tasting jobs
 * pass their retained tasting Bottle even when an exact target points elsewhere;
 * OnBottleChange passes its changed Bottle. This context never selects the stats
 * target or group representative and never contributes to group calculation.
 * Fresh jobs keep a completed job ID from suppressing later committed events.
 */
export async function queueBottleEntityStats(
  entityStatsBottleId: number,
): Promise<void> {
  const bottle = await db.query.bottles.findFirst({
    columns: { brandId: true, bottlerId: true },
    where: (bottles, { eq }) => eq(bottles.id, entityStatsBottleId),
    with: {
      bottlesToDistillers: {
        columns: { distillerId: true },
      },
    },
  });
  if (!bottle) {
    throw new Error(`Unknown bottle: ${entityStatsBottleId}`);
  }

  const entityIds = uniq(
    [
      ...bottle.bottlesToDistillers.map(({ distillerId }) => distillerId),
      bottle.brandId,
      bottle.bottlerId,
    ].filter(notEmpty),
  );

  for (const entityId of entityIds) {
    await pushJob(
      "UpdateEntityStats",
      { entityId },
      { delay: 5000, removeOnComplete: true, removeOnFail: false },
    );
  }
}
