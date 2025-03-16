import program from "@peated/cli/program";
import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottles,
  entities,
  reviews,
} from "@peated/server/db/schema";
import { findEntity } from "@peated/server/lib/bottleFinder";
import { upsertBottleAlias } from "@peated/server/lib/db";
import {
  formatCategoryName,
  formatExpressionName,
} from "@peated/server/lib/format";
import { normalizeBottle } from "@peated/server/lib/normalize";
import { createCaller } from "@peated/server/trpc/router";
import { runJob } from "@peated/server/worker/client";
import { and, asc, eq, inArray, isNull, ne } from "drizzle-orm";

const subcommand = program.command("bottles");

subcommand
  .command("normalize")
  .argument("[bottleIds...]")
  .option("--dry-run")
  .action(async (bottleIds, options) => {
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
      for (const { id, ...bottle } of query) {
        const { name, ...normalizedData } = normalizeBottle({
          ...bottle,
          isFullName: false,
        });

        const values: Record<string, any> = {};
        if (bottle.name !== name) {
          values.name = name;
          // XXX: this _could_ be wrong if the name did not have the brand in it
          // but that shouldn't happen
          values.fullName = `${bottle.fullName.substring(0, bottle.fullName.length - bottle.name.length)}${name}`;
        }
        if (bottle.singleCask !== normalizedData.singleCask)
          values.singleCask = normalizedData.singleCask;
        if (bottle.caskStrength !== normalizedData.caskStrength)
          values.caskStrength = normalizedData.caskStrength;
        if (bottle.statedAge !== normalizedData.statedAge)
          values.statedAge = normalizedData.statedAge;
        if (bottle.vintageYear !== normalizedData.vintageYear)
          values.vintageYear = normalizedData.vintageYear;
        if (bottle.releaseYear !== normalizedData.releaseYear)
          values.releaseYear = normalizedData.releaseYear;

        if (Object.values(values).length !== 0) {
          console.log(`M: ${bottle.fullName} -> ${JSON.stringify(values)}`);
          if (!options.dryRun) {
            // TODO: doesnt handle conflicts - maybe this should just call bottleUpdate
            await db.transaction(async (tx) => {
              await tx.update(bottles).set(values).where(eq(bottles.id, id));
              if (values.fullName) {
                const aliasName = values.fullName;
                await tx
                  .insert(bottleAliases)
                  .values({ name: aliasName, bottleId: id });
              }
            });
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

          const newName = review.name.slice(entity.name.length + 1) || null;

          console.log(
            `Updating ${bottle.fullName} to ${entity.name} ${newName} (from ${entity.name})`,
          );

          await caller.bottleUpdate({
            bottle: bottle.id,
            expression: newName,
            brand: entity.id,
          });
        }
      }
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

subcommand
  .command("fix-names")
  .description("Update bottle aliases")
  .action(async (options) => {
    const step = 1000;
    const baseQuery = db
      .select({
        bottle: bottles,
        brand: entities,
      })
      .from(bottles)
      .innerJoin(entities, eq(bottles.brandId, entities.id))
      .orderBy(asc(bottles.createdAt));

    let hasResults = true;
    let offset = 0;
    while (hasResults) {
      hasResults = false;
      const query = await baseQuery.offset(offset).limit(step);

      for (const { brand, bottle } of query) {
        const name = formatExpressionName(bottle);
        const fullName = `${brand.shortName || brand.name} ${name}`;
        if (bottle.fullName !== fullName || bottle.name !== name) {
          console.log(`Updating name for bottle ${bottle.id}: ${fullName}`);
          await db.transaction(async (tx) => {
            await tx
              .update(bottles)
              .set({ fullName, name })
              .where(eq(bottles.id, bottle.id));
            const alias = await upsertBottleAlias(tx, fullName, bottle.id);
            if (alias.bottleId !== bottle.id) {
              throw new Error(
                `Alias mismatch: bottle ${bottle.id} != ${alias.bottleId}`,
              );
            }
          });
        }

        hasResults = true;
      }
      offset += step;
    }
  });
