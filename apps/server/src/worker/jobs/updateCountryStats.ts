import { db } from "@peated/server/db";
import {
  bottleTombstones,
  bottles,
  bottlesToDistillers,
  countries,
  entities,
} from "@peated/server/db/schema";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { JobPayload } from "../types";

export const UpdateCountryStatsJobArgsSchema = z
  .object({
    countryId: z.number().int().positive(),
  })
  .strict();

export default async function updateCountryStats(input: JobPayload) {
  const { countryId } = UpdateCountryStatsJobArgsSchema.parse(input);

  await db
    .update(countries)
    .set({
      totalDistillers: sql<string>`(
        SELECT COUNT(DISTINCT ${bottlesToDistillers.distillerId})
        FROM ${bottlesToDistillers}
        INNER JOIN ${bottles}
          ON ${bottles.id} = ${bottlesToDistillers.bottleId}
        INNER JOIN ${entities}
          ON ${entities.id} = ${bottlesToDistillers.distillerId}
        WHERE ${entities.countryId} = ${countries.id}
          AND ${bottles.groupId} IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM ${bottleTombstones}
            WHERE ${bottleTombstones.bottleId} = ${bottles.id}
          )
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
          ) AND ${entities.countryId} = ${countries.id}
        )
        AND ${bottles.groupId} IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM ${bottleTombstones}
          WHERE ${bottleTombstones.bottleId} = ${bottles.id}
        )
      )`,
    })
    .where(eq(countries.id, countryId));
}
