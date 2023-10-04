import { program } from "commander";
import { eq } from "drizzle-orm";
import { bottles } from "~/db/schema";
import generateBottleDescription from "~/tasks/generateBottleDescription";
import { db } from "../db";

program.name("bottles").description("CLI for assisting with bottle admin");

program
  .command("generate-descriptions")
  .description("Generate bottle descriptions")
  .argument("[bottleId]")
  .option("--only-missing")
  .action(async (bottleId, options) => {
    const bottleQuery = await db.query.bottles.findMany({
      where: bottleId
        ? (bottles, { eq }) => eq(bottles.id, bottleId)
        : options.onlyMissing
        ? (bottles, { isNull }) => isNull(bottles.description)
        : undefined,
    });
    for (const bottle of bottleQuery) {
      console.log(
        `Generating description for Bottle ${bottle.id} (${bottle.fullName}).`,
      );
      const description = await generateBottleDescription(bottle.fullName);
      await db
        .update(bottles)
        .set({
          description,
        })
        .where(eq(bottles.id, bottle.id));
    }
  });

program.parseAsync();
