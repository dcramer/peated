import program from "@peated/cli/program";
import { db } from "@peated/server/db";
import {
  bottles,
  bottlesToDistillers,
  entities,
  tastings,
} from "@peated/server/db/schema";
import { pushJob } from "@peated/server/jobs";
import { sql } from "drizzle-orm";

const subcommand = program.command("entities");

subcommand
  .command("generate-descriptions")
  .description("Generate entity descriptions")
  .argument("[entityIds...]")
  .option("--only-missing")
  .action(async (entityIds, options) => {
    const query = await db.query.entities.findMany({
      where: entityIds.length
        ? (entities, { inArray }) => inArray(entities.id, entityIds)
        : options.onlyMissing
          ? (entities, { isNull }) => isNull(entities.description)
          : undefined,
    });
    for (const entity of query) {
      console.log(
        `Generating description for Entity ${entity.id} (${entity.name}).`,
      );
      await pushJob("GenerateEntityDetails", { entityId: entity.id });
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
