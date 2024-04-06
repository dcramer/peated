import program from "@peated/cli/program";
import { db } from "@peated/server/db";
import { bottles, reviews, tastings } from "@peated/server/db/schema";
import { pushJob } from "@peated/server/jobs/client";
import { findEntity } from "@peated/server/lib/bottleFinder";
import { formatCategoryName } from "@peated/server/lib/format";
import { createCaller } from "@peated/server/trpc/router";
import { and, eq, ne, sql } from "drizzle-orm";

const subcommand = program.command("bottles");

subcommand
  .command("generate-descriptions")
  .description("Generate bottle descriptions")
  .argument("[bottleIds...]")
  .option("--only-missing")
  .action(async (bottleIds, options) => {
    const bottleQuery = await db.query.bottles.findMany({
      where: bottleIds.length
        ? (bottles, { inArray }) => inArray(bottles.id, bottleIds)
        : options.onlyMissing
          ? (bottles, { isNull }) => isNull(bottles.description)
          : undefined,
    });
    for (const bottle of bottleQuery) {
      console.log(
        `Generating description for Bottle ${bottle.id} (${bottle.fullName}).`,
      );
      await pushJob("GenerateBottleDetails", { bottleId: bottle.id });
    }
  });

subcommand
  .command("create-missing")
  .description("Create missing bottles")
  .action(async (options) => {
    console.log(`Pushing job [CreateMissingBottles].`);
    await pushJob("CreateMissingBottles");
  });

subcommand
  .command("fix-bad-entities")
  .description("Fix bottles with bad entities")
  .action(async (options) => {
    const results = await db
      .select({ bottle: bottles, review: reviews })
      .from(bottles)
      .innerJoin(
        reviews,
        and(
          eq(reviews.bottleId, bottles.id),
          ne(reviews.name, bottles.fullName),
        ),
      );

    const systemUser = await db.query.users.findFirst({
      where: (table, { eq }) => eq(table.username, "dcramer"),
    });
    if (!systemUser) throw new Error("Unable to identify system user");

    const caller = createCaller({
      user: systemUser,
    });

    for (const { bottle, review } of results) {
      if (bottle.fullName.indexOf(review.name) !== 0) {
        const entity = await findEntity(review.name);
        if (!entity) {
          console.warn(
            `Removing bottle due to unknown entity: ${bottle.fullName}`,
          );
          await caller.bottleDelete(bottle.id);
        } else {
          // probably mismatched bottle
          if (bottle.brandId === entity.id) continue;

          if (!review.name.startsWith(entity.name)) {
            console.log([review.name, entity.name]);
            throw new Error();
          }

          let newName = review.name.slice(entity.name.length + 1);
          if (!newName) newName = formatCategoryName(bottle.category);

          console.log(
            `Updating ${bottle.fullName} to ${entity.name} ${newName} (from ${entity.name})`,
          );

          await caller.bottleUpdate({
            bottle: bottle.id,
            name: newName,
            brand: entity.id,
          });
        }
      }
    }
  });

subcommand.command("fix-stats").action(async () => {
  await db.update(bottles).set({
    avgRating: sql<number>`(
        SELECT AVG(rating)
        FROM ${tastings}
        WHERE ${tastings.bottleId} = ${bottles.id}
      )`,
    totalTastings: sql<number>`(
        SELECT COUNT(*)
        FROM ${tastings}
        WHERE ${tastings.bottleId} = ${bottles.id}
      )`,
  });
});
