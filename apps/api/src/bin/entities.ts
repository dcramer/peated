import { program } from "commander";
import { eq } from "drizzle-orm";
import { entities } from "~/db/schema";
import generateEntityDescription from "~/tasks/generateEntityDescription";
import { db } from "../db";

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
      const description = await generateEntityDescription(entity.name);
      await db
        .update(entities)
        .set({
          description,
        })
        .where(eq(entities.id, entity.id));
    }
  });

program.parseAsync();
