import { db } from "@peated/server/db";
import {
  bottles,
  bottlesToDistillers,
  countries,
  entities,
} from "@peated/server/db/schema";
import { activeBottleWhere } from "@peated/server/lib/activeBottles";
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
          AND ${activeBottleWhere()}
      )`,
    })
    .where(eq(countries.id, countryId));
}
