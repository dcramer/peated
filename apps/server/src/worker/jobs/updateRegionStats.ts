import { db } from "@peated/server/db";
import {
  bottles,
  bottlesToDistillers,
  entities,
  regions,
} from "@peated/server/db/schema";
import { eq, sql } from "drizzle-orm";

export default async ({ regionId }: { regionId: number }) => {
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
      )`,
    })
    .where(eq(regions.id, regionId));
};
