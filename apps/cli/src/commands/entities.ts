import program from "@peated/cli/program";
import { db } from "@peated/server/db";
import { pushJob } from "@peated/server/jobs";

const subcommand = program.command("entities");

subcommand
  .command("generate-descriptions")
  .description("Generate entity descriptions")
  .argument("[entityId]")
  .option("--only-missing")
  .action(async (entityId, options) => {
    const query = await db.query.entities.findMany({
      where: entityId
        ? (entities, { eq }) => eq(entities.id, entityId)
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
