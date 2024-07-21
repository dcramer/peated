import program from "@peated/cli/program";
import { db } from "@peated/server/db";
import { bottleAliases, bottles, reviews } from "@peated/server/db/schema";
import { findEntity } from "@peated/server/lib/bottleFinder";
import { formatCategoryName } from "@peated/server/lib/format";
import { createCaller } from "@peated/server/trpc/router";
import { runJob } from "@peated/server/worker/client";
import { and, asc, eq, inArray, isNull, ne } from "drizzle-orm";
import { generateUniqHash } from "../../../server/src/lib/bottleHash";
import { normalizeBottleName } from "../../../server/src/lib/normalize";
import { mergeBottlesInto } from "../../../server/src/trpc/routes/bottleMerge";

const subcommand = program.command("bottles");

subcommand
  .command("normalize-names")
  .argument("[bottleIds...]")
  .option("--dry-run")
  .action(async (bottleIds, options) => {
    const step = 1000;
    const baseQuery = db
      .select({
        id: bottles.id,
        name: bottles.name,
        statedAge: bottles.statedAge,
        vintageYear: bottles.vintageYear,
      })
      .from(bottles)
      .where(bottleIds.length ? inArray(bottles.id, bottleIds) : undefined)
      .orderBy(asc(bottles.id));

    let hasResults = true;
    let offset = 0;
    while (hasResults) {
      hasResults = false;
      const query = await baseQuery.offset(offset).limit(step);
      for (const { id, ...bottle } of query) {
        const { name, statedAge, vintageYear, releaseYear } =
          normalizeBottleName({
            ...bottle,
            isFullName: false,
          });
        if (
          bottle.name !== name ||
          bottle.statedAge !== statedAge ||
          bottle.vintageYear !== vintageYear ||
          bottle.releaseYear !== releaseYear
        ) {
          console.log(`M: ${bottle.name} -> ${name}`);
          if (!options.dryRun) {
            const values: Record<string, any> = {};
            if (bottle.name !== name) values.name = name;
            if (bottle.statedAge !== statedAge) values.statedAge = statedAge;
            if (bottle.vintageYear !== vintageYear)
              values.vintageYear = vintageYear;
            if (bottle.releaseYear !== releaseYear)
              values.releaseYear = releaseYear;
            await db.update(bottles).set(values).where(eq(bottles.id, id));
          }
        }
        hasResults = true;
      }
      offset += step;
    }
  });

subcommand
  .command("generate-descriptions")
  .description("Generate bottle descriptions")
  .argument("[bottleIds...]")
  .option("--only-missing")
  .action(async (bottleIds, options) => {
    const step = 1000;
    const baseQuery = db
      .select({ id: bottles.id })
      .from(bottles)
      .where(
        bottleIds.length
          ? inArray(bottles.id, bottleIds)
          : options.onlyMissing
            ? isNull(bottles.description)
            : undefined,
      )
      .orderBy(asc(bottles.id));

    let hasResults = true;
    let offset = 0;
    while (hasResults) {
      hasResults = false;
      const query = await baseQuery.offset(offset).limit(step);
      for (const { id } of query) {
        console.log(`Generating description for Bottle ${id}.`);
        await runJob("GenerateBottleDetails", { bottleId: id });
        hasResults = true;
      }
      offset += step;
    }
  });

subcommand
  .command("create-missing")
  .description("Create missing bottles")
  .action(async (options) => {
    console.log(`Pushing job [CreateMissingBottles].`);
    await runJob("CreateMissingBottles");
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

subcommand
  .command("fix-hashes")
  .argument("[bottleIds...]")
  .description("Fix bottle unique hashes")
  .action(async (bottleIds) => {
    const step = 1000;
    const baseQuery = db
      .select()
      .from(bottles)
      .where(bottleIds.length ? inArray(bottles.id, bottleIds) : undefined)
      .orderBy(asc(bottles.id));

    let hasResults = true;
    let offset = 0;
    while (hasResults) {
      hasResults = false;
      const query = await baseQuery.offset(offset).limit(step);
      for (const bottle of query) {
        const uniqHash = generateUniqHash(bottle);
        if (bottle.uniqHash !== uniqHash) {
          console.log(`Updating hash for Bottle ${bottle.id}.`);
          try {
            await db.transaction(async (tx) => {
              await tx
                .update(bottles)
                .set({
                  uniqHash,
                })
                .where(eq(bottles.id, bottle.id));
            });
          } catch (err) {
            console.error(
              `Unable to update hash for ${bottle.id}. Merging instead.`,
              err,
            );
            const [existingBottle] = await db
              .select()
              .from(bottles)
              .where(eq(bottles.uniqHash, uniqHash));
            if (existingBottle.id > bottle.id) {
              mergeBottlesInto(existingBottle, bottle);
            } else {
              mergeBottlesInto(bottle, existingBottle);
            }
          }
        }
        hasResults = true;
      }
      offset += step;
    }
  });

subcommand
  .command("fix-stats")
  .argument("[bottleIds...]")
  .action(async (bottleIds) => {
    const step = 1000;
    const baseQuery = db
      .select({ id: bottles.id })
      .from(bottles)
      .where(bottleIds.length ? inArray(bottles.id, bottleIds) : undefined)
      .orderBy(asc(bottles.id));

    let hasResults = true;
    let offset = 0;
    while (hasResults) {
      hasResults = false;
      const query = await baseQuery.offset(offset).limit(step);
      for (const { id } of query) {
        console.log(`Updating stats for Bottle ${id}.`);
        await runJob("UpdateBottleStats", { bottleId: id });
        hasResults = true;
      }
      offset += step;
    }
  });

subcommand
  .command("index-search")
  .description("Update bottle search indexes")
  .argument("[bottleIds...]")
  .option("--only-missing")
  .action(async (bottleIds, options) => {
    const step = 1000;
    const baseQuery = db
      .select({ id: bottles.id })
      .from(bottles)
      .where(
        bottleIds.length
          ? inArray(bottles.id, bottleIds)
          : options.onlyMissing
            ? isNull(bottles.description)
            : undefined,
      )
      .orderBy(asc(bottles.id));

    let hasResults = true;
    let offset = 0;
    while (hasResults) {
      hasResults = false;
      const query = await baseQuery.offset(offset).limit(step);
      for (const { id } of query) {
        console.log(`Indexing search vectors for Bottle ${id}.`);
        await runJob("IndexBottleSearchVectors", { bottleId: id });
        hasResults = true;
      }
      offset += step;
    }
  });

subcommand
  .command("index-aliases")
  .description("Update bottle alias indexes")
  .option("--only-missing")
  .action(async (options) => {
    const step = 1000;
    const baseQuery = db
      .select({ name: bottleAliases.name })
      .from(bottleAliases)
      .where(options.onlyMissing ? isNull(bottleAliases.embedding) : undefined)
      .orderBy(asc(bottleAliases.createdAt));

    let hasResults = true;
    let offset = 0;
    while (hasResults) {
      hasResults = false;
      const query = await baseQuery.offset(offset).limit(step);
      for (const { name } of query) {
        console.log(`Indexing embeddings for alias ${name}.`);
        await runJob("IndexBottleAlias", { name });
        hasResults = true;
      }
      offset += step;
    }
  });
