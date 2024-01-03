import { program } from "commander";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import {
  bottleAliases,
  bottleTags,
  bottleTombstones,
  bottles,
  bottlesToDistillers,
  collectionBottles,
  reviews,
  storePrices,
  tastings,
} from "../db/schema";
import { pushJob, shutdownClient } from "../jobs";
import { findEntity } from "../lib/bottleFinder";
import { formatCategoryName } from "../lib/format";
import { createCaller } from "../trpc/router";

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
      await pushJob("GenerateBottleDetails", { bottleId: bottle.id });
    }

    await shutdownClient();
  });

program
  .command("create-missing")
  .description("Create missing bottles")
  .action(async (options) => {
    console.log(`Pushing job [CreateMissingBottles].`);
    await pushJob("CreateMissingBottles");

    await shutdownClient();
  });

program
  .command("fix-bad-entities")
  .description("Fix bottles with bad entities")
  .action(async (options) => {
    const results = await db
      .select({ bottle: bottles, review: reviews })
      .from(bottles)
      .innerJoin(reviews, eq(reviews.bottleId, bottles.id));

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
          if (!review.name.startsWith(entity.name)) {
            console.log([review.name, entity.name]);
            throw new Error();
          }

          let newName = review.name.slice(entity.name.length + 1);
          if (!newName) newName = formatCategoryName(bottle.category);

          console.log(
            `Updating ${bottle.fullName} to ${newName} (from ${entity.name})`,
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

// TODO: move logic to utility + tests
program
  .command("merge")
  .description("Merge two or more bottles together")
  .argument("<rootBottleId>")
  .argument("<bottleIds...>")
  .action(async (rootBottleId, bottleIds: number[], options) => {
    const rootEntity = await db.query.bottles.findFirst({
      where: (bottles, { eq }) => eq(bottles.id, rootBottleId),
    });
    if (!rootEntity) {
      throw new Error("Unable to find root entity");
    }
    const query = await db.query.bottles.findMany({
      where: (bottles, { inArray }) => inArray(bottles.id, bottleIds),
    });
    if (query.length != bottleIds.length) {
      throw new Error("Unable to find all entities");
    }

    console.log(
      `Merging bottles ${bottleIds.join(", ")} into ${rootBottleId}.`,
    );

    // TODO: this doesnt handle duplicate bottles
    await db.transaction(async (tx) => {
      await tx
        .update(tastings)
        .set({
          bottleId: rootBottleId,
        })
        .where(inArray(tastings.bottleId, bottleIds));

      await tx
        .update(storePrices)
        .set({
          bottleId: rootBottleId,
        })
        .where(inArray(storePrices.bottleId, bottleIds));

      await tx
        .update(collectionBottles)
        .set({
          bottleId: rootBottleId,
        })
        .where(inArray(collectionBottles.bottleId, bottleIds));

      // TODO: handle conflicts
      await tx
        .update(bottleAliases)
        .set({
          bottleId: rootBottleId,
        })
        .where(inArray(bottleAliases.bottleId, bottleIds));

      for (const id of bottleIds) {
        await tx.insert(bottleTombstones).values({
          bottleId: id,
          newBottleId: rootBottleId,
        });
      }

      // update materialized stats
      await tx
        .update(bottles)
        .set({
          totalTastings: sql`(SELECT COUNT(*) FROM ${tastings} WHERE ${bottles.id} = ${tastings.bottleId})`,
          avgRating: sql`(SELECT AVG(${tastings.rating}) FROM ${tastings} WHERE ${bottles.id} = ${tastings.bottleId})`,
        })
        .where(eq(bottles.id, rootBottleId));

      // TODO: update bottleTags
      //   await tx
      //     .insert(bottleTags)
      //     .values({
      //       bottleId: rootBottleId,
      //       tag,
      //       count: 1,
      //     })
      //     .onConflictDoUpdate({
      //       target: [bottleTags.bottleId, bottleTags.tag],
      //       set: {
      //         count: sql<number>`${bottleTags.count} + 1`,
      //       },
      //     });

      // wipe old bottles
      await tx
        .delete(bottleTags)
        .where(inArray(bottleTags.bottleId, bottleIds));
      await tx
        .delete(bottlesToDistillers)
        .where(inArray(bottlesToDistillers.bottleId, bottleIds));
      await tx.delete(bottles).where(inArray(bottles.id, bottleIds));
    });
  });

program.parseAsync();
