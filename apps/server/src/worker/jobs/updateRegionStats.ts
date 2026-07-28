import { db } from "@peated/server/db";
import {
  bottleGroupTombstones,
  bottleTombstones,
  bottles,
  bottlesToDistillers,
  entities,
  regions,
} from "@peated/server/db/schema";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

export const UpdateRegionStatsJobArgsSchema = z
  .object({
    regionId: z.number().int().positive(),
  })
  .strict();

export default async function updateRegionStats(input: unknown) {
  const { regionId } = UpdateRegionStatsJobArgsSchema.parse(input);

  await db
    .update(regions)
    .set({
      totalDistillers: sql<string>`(
        SELECT COUNT(*)
        FROM ${entities}
        WHERE 'distiller' = ANY(${entities.type})
          AND ${entities.regionId} = ${regions.id}
      )`,
      totalBottles: sql<string>`(
        SELECT COUNT(*)
        FROM ${bottles}
        WHERE EXISTS (
          SELECT FROM ${entities}
          WHERE (
            ${bottles.brandId} = ${entities.id}
            OR ${bottles.bottlerId} = ${entities.id}
            OR EXISTS(
                SELECT FROM ${bottlesToDistillers}
                WHERE ${bottlesToDistillers.bottleId} = ${bottles.id}
                AND ${bottlesToDistillers.distillerId} = ${entities.id}
            )
          ) AND ${entities.regionId} = ${regions.id}
        )
        AND ${bottles.groupId} IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM ${bottleTombstones}
          WHERE ${bottleTombstones.bottleId} = ${bottles.id}
        )
        AND NOT EXISTS (
          SELECT 1
          FROM ${bottleGroupTombstones}
          WHERE ${bottleGroupTombstones.groupId} = ${bottles.groupId}
        )
      )`,
    })
    .where(eq(regions.id, regionId));
}
