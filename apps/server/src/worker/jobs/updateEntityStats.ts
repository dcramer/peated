import { db } from "@peated/server/db";
import {
  bottles,
  bottlesToDistillers,
  entities,
  tastings,
} from "@peated/server/db/schema";
import { pushUniqueJob } from "@peated/server/worker/client";
import { eq, sql } from "drizzle-orm";

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
