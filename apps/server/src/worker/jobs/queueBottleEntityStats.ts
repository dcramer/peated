import { db } from "@peated/server/db";
import { notEmpty, uniq } from "@peated/server/lib/filter";
import { pushJob } from "@peated/server/worker/client";

async function queueEntityStats(owner: {
  brandId: number;
  bottlerId: number | null;
  distillerIds: number[];
}): Promise<void> {
  const entityIds = uniq(
    [...owner.distillerIds, owner.brandId, owner.bottlerId].filter(notEmpty),
  );

  for (const entityId of entityIds) {
    await pushJob(
      "UpdateEntityStats",
      { entityId },
      { delay: 5000, removeOnComplete: true, removeOnFail: false },
    );
  }
}

/** Queue entity aggregates owned by one independently complete Bottle. */
export async function queueBottleEntityStats(bottleId: number): Promise<void> {
  const bottle = await db.query.bottles.findFirst({
    columns: { brandId: true, bottlerId: true },
    where: (bottles, { eq }) => eq(bottles.id, bottleId),
    with: {
      bottlesToDistillers: {
        columns: { distillerId: true },
      },
    },
  });
  if (!bottle) {
    throw new Error(`Bottle ${bottleId} is not active.`);
  }

  await queueEntityStats({
    brandId: bottle.brandId,
    bottlerId: bottle.bottlerId,
    distillerIds: bottle.bottlesToDistillers.map(
      ({ distillerId }) => distillerId,
    ),
  });
}

/** Queue entity aggregates owned by one BottleGroup's shared presentation. */
export async function queueBottleGroupEntityStats(
  groupId: number,
): Promise<void> {
  const owner = await db.query.bottleGroups.findFirst({
    columns: { brandId: true, bottlerId: true },
    where: (bottleGroups, { eq }) => eq(bottleGroups.id, groupId),
    with: {
      distillers: {
        columns: { distillerId: true },
      },
    },
  });
  if (!owner) {
    throw new Error(`BottleGroup ${groupId} is not active.`);
  }

  await queueEntityStats({
    brandId: owner.brandId,
    bottlerId: owner.bottlerId,
    distillerIds: owner.distillers.map(({ distillerId }) => distillerId),
  });
}
