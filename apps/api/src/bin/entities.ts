import { db } from "@peated/core/db";
import pushJob, { shutdownClient } from "@peated/core/jobs";
import { program } from "commander";

program.name("entities").description("CLI for assisting with entity admin");

program
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

    await shutdownClient();
  });

program.parseAsync();
