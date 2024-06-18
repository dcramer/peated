import program from "@peated/cli/program";
import { db } from "@peated/server/db";
import {
  bottles,
  bottlesToDistillers,
  entities,
  tastings,
} from "@peated/server/db/schema";
import { pushJob } from "@peated/server/jobs/client";
import { and, asc, inArray, isNotNull, isNull, sql } from "drizzle-orm";

const subcommand = program.command("entities");

subcommand
  .command("generate-descriptions")
  .description("Generate entity descriptions")
  .argument("[entityIds...]")
  .option("--only-missing")
  .action(async (entityIds, options) => {
    const step = 1000;
    const baseQuery = db
      .select({ id: entities.id })
      .from(entities)
      .where(
        entityIds.length
          ? inArray(entities.id, entityIds)
          : options.onlyMissing
            ? isNull(entities.description)
            : undefined,
      )
      .orderBy(asc(entities.id));

    let hasResults = true;
    let offset = 0;
    while (hasResults) {
      hasResults = false;
      const query = await baseQuery.offset(offset).limit(step);
      for (const { id } of query) {
        console.log(`Generating description for Entity ${id}.`);
        await pushJob("GenerateEntityDetails", { entityId: id });
        hasResults = true;
      }
      offset += step;
    }
  });

subcommand
  .command("geocode-locations")
  .description("Geocode entity locations")
  .argument("[entityIds...]")
  .option("--only-missing")
  .action(async (entityIds, options) => {
    const step = 1000;
    const baseQuery = db
      .select({ id: entities.id })
      .from(entities)
      .where(
        and(
          sql`${"distiller"} = ANY(${entities.type})`,
          isNotNull(entities.address),
          isNotNull(entities.country),
          entityIds.length
            ? inArray(entities.id, entityIds)
            : options.onlyMissing
              ? isNull(entities.location)
              : undefined,
        ),
      )
      .orderBy(asc(entities.id));

    let hasResults = true;
    let offset = 0;
    while (hasResults) {
      hasResults = false;
      const query = await baseQuery.offset(offset).limit(step);
      for (const { id } of query) {
        console.log(`Geocoding location for Entity ${id}.`);
        await pushJob("GeocodeEntityLocation", { entityId: id });
        hasResults = true;
      }
      offset += step;
    }
  });

subcommand.command("fix-stats").action(async () => {
  await db.update(entities).set({
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
  });
});
