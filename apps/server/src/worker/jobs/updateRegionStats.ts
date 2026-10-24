import { db } from "@peated/server/db";
import {
  bottles,
  bottlesToDistillers,
  entities,
  regions,
} from "@peated/server/db/schema";
import { activeBottleWhere } from "@peated/server/lib/activeBottles";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { JobPayload } from "../types";

export const UpdateRegionStatsJobArgsSchema = z
  .object({
    regionId: z.number().int().positive(),
  })
  .strict();

export default async function updateRegionStats(input: JobPayload) {
  const { regionId } = UpdateRegionStatsJobArgsSchema.parse(input);

  await db
    .update(regions)
    .set({
      totalDistillers: sql<string>`(
        SELECT COUNT(DISTINCT ${bottlesToDistillers.distillerId})
        FROM ${bottlesToDistillers}
        INNER JOIN ${bottles}
          ON ${bottles.id} = ${bottlesToDistillers.bottleId}
        INNER JOIN ${entities}
          ON ${entities.id} = ${bottlesToDistillers.distillerId}
        WHERE ${entities.regionId} = ${regions.id}
          AND ${activeBottleWhere()}
      )`,
    })
    .where(eq(regions.id, regionId));
}
