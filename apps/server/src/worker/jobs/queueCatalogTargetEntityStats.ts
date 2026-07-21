import { db } from "@peated/server/db";
import type { CatalogTargetAssignmentDescriptor } from "@peated/server/lib/catalogTargets";
import { notEmpty, uniq } from "@peated/server/lib/filter";
import { pushJob } from "@peated/server/worker/client";

/** Queue entity aggregates for the authoritative exact or generic target owner. */
export async function queueCatalogTargetEntityStats(
  target: CatalogTargetAssignmentDescriptor,
): Promise<void> {
  const exactBottleId = target.bottleId;
  const owner =
    exactBottleId === null
      ? await db.query.bottleGroups.findFirst({
          columns: { brandId: true, bottlerId: true },
          where: (bottleGroups, { eq }) => eq(bottleGroups.id, target.groupId),
          with: {
            distillers: {
              columns: { distillerId: true },
            },
          },
        })
      : await db.query.bottles.findFirst({
          columns: { brandId: true, bottlerId: true },
          where: (bottles, { and, eq }) =>
            and(
              eq(bottles.id, exactBottleId),
              eq(bottles.groupId, target.groupId),
            ),
          with: {
            bottlesToDistillers: {
              columns: { distillerId: true },
            },
          },
        });
  if (!owner) {
    throw new Error(
      `CatalogTarget ${target.targetId} has no active ${exactBottleId === null ? "BottleGroup" : "Bottle"} owner.`,
    );
  }

  const distillerIds =
    "distillers" in owner
      ? owner.distillers.map(({ distillerId }) => distillerId)
      : owner.bottlesToDistillers.map(({ distillerId }) => distillerId);
  const entityIds = uniq(
    [...distillerIds, owner.brandId, owner.bottlerId].filter(notEmpty),
  );

  for (const entityId of entityIds) {
    await pushJob(
      "UpdateEntityStats",
      { entityId },
      { delay: 5000, removeOnComplete: true, removeOnFail: false },
    );
  }
}
