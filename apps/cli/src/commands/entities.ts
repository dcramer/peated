import program from "@peated/cli/program";
import { db } from "@peated/server/db";
import { entities } from "@peated/server/db/schema";
import { runJob } from "@peated/server/worker/client";
import { and, asc, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";

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
        await runJob("GenerateEntityDetails", { entityId: id });
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
          or(
            sql`${"distiller"} = ANY(${entities.type})`,
            sql`${"bottler"} = ANY(${entities.type})`,
          ),
          isNotNull(entities.countryId),
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
        await runJob("GeocodeEntityLocation", { entityId: id, force: true });
        hasResults = true;
      }
      offset += step;
    }
  });

subcommand
  .command("fix-stats")
  .argument("[entityIds...]")
  .action(async (entityIds) => {
    const step = 1000;
    const baseQuery = db
      .select({ id: entities.id })
      .from(entities)
      .where(entityIds.length ? inArray(entities.id, entityIds) : undefined)
      .orderBy(asc(entities.id));

    let hasResults = true;
    let offset = 0;
    while (hasResults) {
      hasResults = false;
      const query = await baseQuery.offset(offset).limit(step);
      for (const { id } of query) {
        console.log(`Updating stats for Entity ${id}.`);
        await runJob("UpdateEntityStats", { entityId: id });
        hasResults = true;
      }
      offset += step;
    }
  });

subcommand
  .command("index-search")
  .description("Update entity search indexes")
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
            ? isNull(entities.location)
            : undefined,
      )
      .orderBy(asc(entities.id));

    let hasResults = true;
    let offset = 0;
    while (hasResults) {
      hasResults = false;
      const query = await baseQuery.offset(offset).limit(step);
      for (const { id } of query) {
        console.log(`Indexing search vectors for Entity ${id}.`);
        await runJob("IndexEntitySearchVectors", { entityId: id });
        hasResults = true;
      }
      offset += step;
    }
  });
