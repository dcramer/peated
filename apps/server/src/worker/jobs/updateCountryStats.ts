import { db } from "@peated/server/db";
import {
  bottles,
  bottlesToDistillers,
  countries,
  entities,
} from "@peated/server/db/schema";
import { eq, sql } from "drizzle-orm";

export default async ({ countryId }: { countryId: number }) => {
  await db
    .update(countries)
    .set({
      totalBottles: sql<number>`(
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
      )`,
    })
    .where(eq(countries.id, countryId));
};
