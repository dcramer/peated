import { db } from "@peated/server/db";
import {
  bottles,
  bottlesToDistillers,
  entities,
  tastings,
} from "@peated/server/db/schema";
import { eq, sql } from "drizzle-orm";
import { runJob } from "./";

export default async ({ entityId }: { entityId: number }) => {
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
        totalBottles: sql<number>`(
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
      )`,
      })
      .where(eq(entities.id, entityId));

    await tx
      .update(entities)
      .set({
        totalBottles: sql<number>`(
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
        )`,
        totalTastings: sql<number>`(
          SELECT COUNT(*)
          FROM ${tastings}
          WHERE ${tastings.bottleId} IN (
            SELECT ${bottles.id}
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
            )
        )`,
        updatedAt: sql`NOW()`,
      })
      .where(eq(entities.id, entityId));
  });

  if (entity.countryId) {
    runJob("UpdateCountryStats", { countryId: entity.countryId });
  }
  if (entity.regionId) {
    runJob("UpdateRegionStats", { regionId: entity.regionId });
  }
};
