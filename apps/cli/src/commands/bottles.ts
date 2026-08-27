import program from "@peated/cli/program";
import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottleGroups,
  bottles,
  bottleTombstones,
  entities,
  externalReviewArticles,
  externalReviews,
  externalReviewSourcePolicies,
} from "@peated/server/db/schema";
import { findEntityByExactNameOrAlias } from "@peated/server/lib/db";
import { countedExternalReviewScoreWhere } from "@peated/server/lib/externalReviewScores";
import { fixBadExternalReviewEntities } from "@peated/server/lib/fixBadExternalReviewEntities";
import { repairBottleBrandDistilleryAssignments } from "@peated/server/lib/repairBottleBrandDistilleryAssignments";
import { getAutomationModeratorUser } from "@peated/server/lib/systemUser";
import { routerClient } from "@peated/server/orpc/router";
import { runJob } from "@peated/server/worker/client";
import { and, asc, count, eq, inArray, isNull } from "drizzle-orm";

const subcommand = program.command("bottles");

async function resolveEntityReference(
  value: string,
  { label }: { label: string },
) {
  const entity = /^\d+$/.test(value)
    ? await db.query.entities.findFirst({
        where: eq(entities.id, Number.parseInt(value, 10)),
      })
    : await findEntityByExactNameOrAlias(db, value);

  if (!entity) {
    throw new Error(`${label} not found: ${value}`);
  }

  return entity;
}

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
      .innerJoin(bottleGroups, eq(bottleGroups.id, bottles.groupId))
      .leftJoin(bottleTombstones, eq(bottleTombstones.bottleId, bottles.id))
      .where(
        and(
          isNull(bottleTombstones.bottleId),
          bottleIds.length
            ? inArray(bottles.id, bottleIds)
            : options.onlyMissing
              ? isNull(bottles.description)
              : undefined,
        ),
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
  .command("fix-bad-external-review-entities")
  .description("Re-resolve mismatched external review Bottle assignments")
  .action(async (options) => {
    const systemUser = await getAutomationModeratorUser();
    const summary = await fixBadExternalReviewEntities({ user: systemUser });
    console.log(
      `Processed ${summary.scanned} mismatched external reviews: ${summary.reassigned} reassigned, ${summary.unresolved} unresolved, ${summary.errored} errored, ${summary.unchanged} unchanged.`,
    );
  });

subcommand
  .command("fix-stats")
  .argument("[bottleIds...]")
  .action(async (bottleIds) => {
    const step = 1000;
    const requestedBottleIds = bottleIds.map((token: string) => {
      const bottleId = Number(token);
      if (!Number.isSafeInteger(bottleId) || bottleId <= 0) {
        throw new Error(
          `Invalid Bottle ID "${token}": expected a positive safe integer.`,
        );
      }
      return bottleId;
    });

    let hasResults = true;
    let offset = 0;
    const processedBottleIds: number[] = [];
    while (hasResults) {
      hasResults = false;
      const query = await db
        .select({ bottleId: bottles.id })
        .from(bottles)
        .innerJoin(bottleGroups, eq(bottleGroups.id, bottles.groupId))
        .leftJoin(bottleTombstones, eq(bottleTombstones.bottleId, bottles.id))
        .where(
          and(
            isNull(bottleTombstones.bottleId),
            requestedBottleIds.length
              ? inArray(bottles.id, requestedBottleIds)
              : undefined,
          ),
        )
        .orderBy(asc(bottles.id))
        .offset(offset)
        .limit(step);
      for (const { bottleId } of query) {
        console.log(`Updating stats for Bottle ${bottleId}.`);
        await runJob("UpdateBottleStats", { bottleId });
        processedBottleIds.push(bottleId);
        hasResults = true;
      }
      offset += step;
    }

    if (processedBottleIds.length) {
      const expectedRows = await db
        .select({
          bottleId: externalReviews.bottleId,
          count: count(externalReviews.id),
        })
        .from(externalReviews)
        .innerJoin(
          externalReviewArticles,
          eq(externalReviewArticles.id, externalReviews.articleId),
        )
        .innerJoin(
          externalReviewSourcePolicies,
          eq(
            externalReviewSourcePolicies.externalSiteId,
            externalReviewArticles.externalSiteId,
          ),
        )
        .where(
          and(
            inArray(externalReviews.bottleId, processedBottleIds),
            countedExternalReviewScoreWhere(),
          ),
        )
        .groupBy(externalReviews.bottleId);
      const expectedByBottle = new Map(
        expectedRows.map(({ bottleId, count }) => [bottleId, count]),
      );
      const storedRows = await db
        .select({
          bottleId: bottles.id,
          externalScoreCount: bottles.externalScoreCount,
        })
        .from(bottles)
        .where(inArray(bottles.id, processedBottleIds));
      const mismatches = storedRows.filter(
        ({ bottleId, externalScoreCount }) =>
          externalScoreCount !== (expectedByBottle.get(bottleId) ?? 0),
      );
      if (mismatches.length) {
        throw new Error(
          `External review score count verification failed for ${mismatches.length} Bottles.`,
        );
      }
      console.log(
        `Verified external score counts for ${storedRows.length} Bottles.`,
      );
    }
  });

subcommand
  .command("index-search")
  .description("Update bottle search indexes")
  .argument("[bottleIds...]")
  .action(async (bottleIds) => {
    const step = 1000;
    const bottleQuery = db
      .select({ id: bottles.id })
      .from(bottles)
      .where(bottleIds.length ? inArray(bottles.id, bottleIds) : undefined)
      .orderBy(asc(bottles.id));

    let hasResults = true;
    let offset = 0;
    while (hasResults) {
      hasResults = false;
      const query = await bottleQuery.offset(offset).limit(step);
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
  .description("Rebuild exact alias embeddings and clear ineligible aliases")
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
  .command("repair-brand-distillery")
  .description("Preview or apply bulk bottle brand/distillery identity repairs")
  .requiredOption("--from-brand <entity>", "Source brand entity name or id")
  .requiredOption("--to-brand <entity>", "Target brand entity name or id")
  .option(
    "--distillery <entity>",
    "Distillery entity name or id to ensure on repaired bottles",
  )
  .option("--limit <number>", "Maximum number of bottles to scan")
  .option("--query <query>", "Filter candidate bottles by full name", "")
  .option(
    "--execute",
    "Actually apply the repair. Without this flag the command only previews.",
  )
  .argument("[bottleIds...]")
  .action(async (bottleIds: string[], options) => {
    const fromBrand = await resolveEntityReference(options.fromBrand, {
      label: "Source brand",
    });
    const toBrand = await resolveEntityReference(options.toBrand, {
      label: "Target brand",
    });
    const distillery = options.distillery
      ? await resolveEntityReference(options.distillery, {
          label: "Distillery",
        })
      : null;

    let limit: number | undefined;
    if (options.limit !== undefined) {
      const parsedLimit = Number.parseInt(options.limit, 10);
      if (
        !Number.isFinite(parsedLimit) ||
        Number.isNaN(parsedLimit) ||
        parsedLimit <= 0
      ) {
        throw new Error(`Invalid limit: ${options.limit}`);
      }
      limit = parsedLimit;
    }

    const result = await repairBottleBrandDistilleryAssignments({
      bottleIds: bottleIds.map((value: string) => Number.parseInt(value, 10)),
      distilleryId: distillery?.id ?? null,
      dryRun: !options.execute,
      fromBrand,
      limit,
      query: options.query,
      toBrand,
      user: options.execute ? await getAutomationModeratorUser() : undefined,
    });

    console.log(
      `${options.execute ? "Applied" : "Previewed"} bottle brand/distillery repairs: ${result.summary.total}`,
    );
    console.log(
      `planned=${result.summary.planned} applied=${result.summary.applied} failed=${result.summary.failed} seriesCreated=${result.summary.seriesCreated} seriesReused=${result.summary.seriesReused}`,
    );

    for (const item of result.items) {
      console.log(`[${item.status}] ${item.bottleFullName} (${item.bottleId})`);
      console.log(`  ${item.message}`);
    }

    if (options.execute && result.summary.failed > 0) {
      throw new Error(
        `${result.summary.failed} bottle repair(s) failed during execution.`,
      );
    }
  });
