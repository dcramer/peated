import program from "@peated/cli/program";
import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottleGroups,
  bottles,
  bottleTombstones,
  entities,
} from "@peated/server/db/schema";
import { findEntityByExactNameOrAlias } from "@peated/server/lib/db";
import { fixBadReviewEntities } from "@peated/server/lib/fixBadReviewEntities";
import { repairBottleBrandDistilleryAssignments } from "@peated/server/lib/repairBottleBrandDistilleryAssignments";
import { repairInvalidSourceBottleAliases } from "@peated/server/lib/repairInvalidSourceBottleAliases";
import { getAutomationModeratorUser } from "@peated/server/lib/systemUser";
import { routerClient } from "@peated/server/orpc/router";
import { runJob } from "@peated/server/worker/client";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";

const subcommand = program.command("bottles");

async function resolveEntityReference(
  value: string,
  {
    label,
    requiredType,
  }: {
    label: string;
    requiredType?: "brand" | "distiller" | "bottler";
  },
) {
  const entity = /^\d+$/.test(value)
    ? await db.query.entities.findFirst({
        where: eq(entities.id, Number.parseInt(value, 10)),
      })
    : await findEntityByExactNameOrAlias(db, value);

  if (!entity) {
    throw new Error(`${label} not found: ${value}`);
  }

  if (requiredType && !entity.type.includes(requiredType)) {
    throw new Error(
      `${label} must include entity type "${requiredType}": ${entity.name}`,
    );
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
  .command("fix-bad-entities")
  .description("Re-resolve mismatched review bottle assignments")
  .action(async (options) => {
    const systemUser = await getAutomationModeratorUser();
    const summary = await fixBadReviewEntities({ user: systemUser });
    console.log(
      `Processed ${summary.scanned} mismatched reviews: ${summary.reassigned} reassigned, ${summary.unresolved} unresolved, ${summary.errored} errored, ${summary.unchanged} unchanged.`,
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
        hasResults = true;
      }
      offset += step;
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
      requiredType: "brand",
    });
    const toBrand = await resolveEntityReference(options.toBrand, {
      label: "Target brand",
      requiredType: "brand",
    });
    const distillery = options.distillery
      ? await resolveEntityReference(options.distillery, {
          label: "Distillery",
          requiredType: "distiller",
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

subcommand
  .command("repair-source-aliases")
  .description(
    "Preview or unassign invalid BottleAlias rows from source-only price approvals",
  )
  .option(
    "--limit <number>",
    "Maximum number of BottleAlias rows to scan",
    "100",
  )
  .option("--execute", "Apply repairs to the explicitly named BottleAlias rows")
  .argument("[aliasNames...]")
  .action(async (aliasNames: string[], options) => {
    const limit = Number.parseInt(options.limit, 10);
    if (!Number.isSafeInteger(limit) || limit <= 0) {
      throw new Error(`Invalid limit: ${options.limit}`);
    }
    if (options.execute && aliasNames.length === 0) {
      throw new Error(
        "--execute requires one or more explicit BottleAlias names.",
      );
    }

    const result = await repairInvalidSourceBottleAliases({
      aliasNames,
      dryRun: !options.execute,
      limit,
      user: options.execute ? await getAutomationModeratorUser() : undefined,
    });
    console.log(
      `${options.execute ? "Processed" : "Previewed"} BottleAlias rows: ${result.summary.total}`,
    );
    console.log(
      `planned=${result.summary.planned} applied=${result.summary.applied} reviewRequired=${result.summary.review_required} failed=${result.summary.failed}`,
    );
    for (const item of result.items) {
      const evidence = item.evidenceProposalIds.length
        ? ` proposals=${item.evidenceProposalIds.join(",")}`
        : "";
      console.log(
        `[${item.status}] ${item.aliasName} bottle=${item.bottleId ?? "none"}${evidence}`,
      );
      console.log(`  ${item.message}`);
    }
    if (
      options.execute &&
      result.summary.failed + result.summary.review_required > 0
    ) {
      throw new Error(
        `${result.summary.failed + result.summary.review_required} requested BottleAlias repair(s) were not applied.`,
      );
    }
  });
