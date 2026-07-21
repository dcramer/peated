import { db } from "@peated/server/db";
import {
  bottleGroupDistillers,
  bottleGroups,
  bottleTombstones,
  bottles,
  bottlesToDistillers,
  catalogTargets,
  entities,
  tastings,
} from "@peated/server/db/schema";
import { pushUniqueJob } from "@peated/server/worker/client";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

export const UpdateEntityStatsJobArgsSchema = z
  .object({
    entityId: z.number().int().positive(),
  })
  .strict();
export type UpdateEntityStatsJobArgs = z.infer<
  typeof UpdateEntityStatsJobArgsSchema
>;

export default async (input: unknown) => {
  const { entityId } = UpdateEntityStatsJobArgsSchema.parse(input);
  const entity = await db.query.entities.findFirst({
    where: (entities, { eq }) => eq(entities.id, entityId),
  });
  if (!entity) {
    throw new Error(`Unknown entity: ${entityId}`);
  }

  await db.transaction(async (tx) => {
    await tx
      .update(entities)
      .set({
        totalBottles: sql<string>`(
          SELECT COUNT(*)
          FROM ${bottles}
          WHERE (
            ${bottles.brandId} = ${entities.id}
            OR ${bottles.bottlerId} = ${entities.id}
            OR EXISTS(
              SELECT FROM ${bottlesToDistillers}
              WHERE ${bottlesToDistillers.bottleId} = ${bottles.id}
              AND ${bottlesToDistillers.distillerId} = ${entities.id}
            )
          )
          AND NOT EXISTS (
            SELECT 1
            FROM ${bottleTombstones}
            WHERE ${bottleTombstones.bottleId} = ${bottles.id}
          )
          AND EXISTS (
            SELECT 1
            FROM ${catalogTargets}
            WHERE ${catalogTargets.bottleId} = ${bottles.id}
            AND ${catalogTargets.groupId} = ${bottles.groupId}
          )
        )`,
        totalTastings: sql<string>`(
          SELECT COUNT(*)
          FROM ${tastings}
          INNER JOIN ${catalogTargets}
            ON ${catalogTargets.id} = ${tastings.targetId}
          WHERE (
            (
              ${catalogTargets.bottleId} IS NOT NULL
              AND EXISTS (
                SELECT 1
                FROM ${bottles}
                WHERE ${bottles.id} = ${catalogTargets.bottleId}
                AND ${bottles.groupId} = ${catalogTargets.groupId}
                AND NOT EXISTS (
                  SELECT 1
                  FROM ${bottleTombstones}
                  WHERE ${bottleTombstones.bottleId} = ${bottles.id}
                )
                AND (
                  ${bottles.brandId} = ${entities.id}
                  OR ${bottles.bottlerId} = ${entities.id}
                  OR EXISTS (
                    SELECT 1
                    FROM ${bottlesToDistillers}
                    WHERE ${bottlesToDistillers.bottleId} = ${bottles.id}
                    AND ${bottlesToDistillers.distillerId} = ${entities.id}
                  )
                )
              )
            )
            OR (
              ${catalogTargets.bottleId} IS NULL
              AND EXISTS (
                SELECT 1
                FROM ${bottleGroups}
                WHERE ${bottleGroups.id} = ${catalogTargets.groupId}
                AND (
                  ${bottleGroups.brandId} = ${entities.id}
                  OR ${bottleGroups.bottlerId} = ${entities.id}
                  OR EXISTS (
                    SELECT 1
                    FROM ${bottleGroupDistillers}
                    WHERE ${bottleGroupDistillers.groupId} = ${bottleGroups.id}
                    AND ${bottleGroupDistillers.distillerId} = ${entities.id}
                  )
                )
              )
            )
          )
        )`,
        updatedAt: sql`NOW()`,
      })
      .where(eq(entities.id, entityId));
  });

  if (entity.countryId) {
    await pushUniqueJob(
      "UpdateCountryStats",
      { countryId: entity.countryId },
      { delay: 5000 },
    );
  }
  if (entity.regionId) {
    await pushUniqueJob(
      "UpdateRegionStats",
      { regionId: entity.regionId },
      { delay: 5000 },
    );
  }
};
