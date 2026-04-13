import program from "@peated/cli/program";
import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottleReleases,
  bottles,
  entities,
  reviews,
} from "@peated/server/db/schema";
import {
  applyRepairBackfillProposals,
  type BatchApplicableRepairBackfillProposalType,
} from "@peated/server/lib/applyRepairBackfillProposals";
import { findEntity } from "@peated/server/lib/bottleFinder";
import { upsertBottleAlias } from "@peated/server/lib/db";
import {
  formatBottleName,
  formatCategoryName,
} from "@peated/server/lib/format";
import {
  getHeuristicLegacyReleaseRepairCandidates,
  type LegacyReleaseRepairCandidate,
} from "@peated/server/lib/legacyReleaseRepairCandidates";
import {
  getLegacyReleaseRepairReviewBlockedReasonCategory,
  refreshLegacyReleaseRepairReview,
} from "@peated/server/lib/legacyReleaseRepairReviews";
import { normalizeBottle } from "@peated/server/lib/normalize";
import {
  getRepairBackfillProposals,
  type RepairBackfillProposal,
  type RepairBackfillProposalType,
} from "@peated/server/lib/repairBackfillProposals";
import { getAutomationModeratorUser } from "@peated/server/lib/systemUser";
import { routerClient } from "@peated/server/orpc/router";
import { runJob } from "@peated/server/worker/client";
import { and, asc, eq, inArray, isNull, ne } from "drizzle-orm";

const subcommand = program.command("bottles");
const REPAIR_BACKFILL_PROPOSAL_TYPES = ["release", "age", "canon"] as const;
const REPAIR_BACKFILL_PROPOSAL_FORMATS = ["summary", "json"] as const;
const APPLICABLE_REPAIR_BACKFILL_PROPOSAL_TYPES = ["release", "age"] as const;

function parseRepairBackfillProposalTypes(
  value: string,
): RepairBackfillProposalType[] {
  if (value === "all") {
    return [...REPAIR_BACKFILL_PROPOSAL_TYPES];
  }

  const types = Array.from(
    new Set(
      value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );

  if (types.length === 0) {
    throw new Error(
      "Repair proposal types must include one of: release, age, canon, all.",
    );
  }

  for (const type of types) {
    if (!REPAIR_BACKFILL_PROPOSAL_TYPES.includes(type as never)) {
      throw new Error(
        `Unknown repair proposal type: ${type}. Expected one of: release, age, canon, all.`,
      );
    }
  }

  return types as RepairBackfillProposalType[];
}

function parseBatchApplicableRepairBackfillProposalTypes(
  value: string,
): BatchApplicableRepairBackfillProposalType[] {
  if (value === "all") {
    return [...APPLICABLE_REPAIR_BACKFILL_PROPOSAL_TYPES];
  }

  const types = Array.from(
    new Set(
      value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );

  if (types.length === 0) {
    throw new Error(
      "Repair apply types must include one of: release, age, all.",
    );
  }

  for (const type of types) {
    if (!APPLICABLE_REPAIR_BACKFILL_PROPOSAL_TYPES.includes(type as never)) {
      throw new Error(
        `Unknown batch-applicable repair proposal type: ${type}. Expected one of: release, age, all.`,
      );
    }
  }

  return types as BatchApplicableRepairBackfillProposalType[];
}

function parseRepairBackfillProposalFormat(value: string): "json" | "summary" {
  if (!REPAIR_BACKFILL_PROPOSAL_FORMATS.includes(value as never)) {
    throw new Error(
      `Unknown repair proposal format: ${value}. Expected one of: summary, json.`,
    );
  }

  return value as "json" | "summary";
}

function formatRepairBackfillProposalSummaryLine(
  proposal: RepairBackfillProposal,
) {
  const automationState = proposal.automationEligible ? "auto" : "review";

  switch (proposal.type) {
    case "release":
      return `[release/${proposal.repairMode}/${proposal.actionability}/${automationState}] ${proposal.bottle.fullName} -> ${proposal.proposedParent.fullName}`;
    case "age":
      return `[age/${proposal.repairMode}/${proposal.actionability}/${automationState}] ${proposal.bottle.fullName} -> ${proposal.targetRelease.fullName}`;
    case "canon":
      return `[canon/${proposal.actionability}/${automationState}] ${proposal.bottle.fullName} -> ${proposal.targetBottle.fullName}`;
  }
}

function formatReleaseRepairReviewSummaryLine(
  candidate: LegacyReleaseRepairCandidate,
) {
  return `[release/${candidate.repairMode}] ${candidate.legacyBottle.fullName} -> ${candidate.proposedParent.fullName}`;
}

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
          values.fullName = formatBottleName({
            ...bottle,
            name: `${bottle.fullName.substring(0, bottle.fullName.length - bottle.name.length)}${name}`,
          });
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

    for (const { bottle, review } of results) {
      if (bottle.fullName.indexOf(review.name) !== 0) {
        const entity = await findEntity(review.name);
        if (!entity) {
          console.warn(
            `Removing bottle due to unknown entity: ${bottle.fullName}`,
          );
          await routerClient.bottles.delete(
            { bottle: bottle.id },
            {
              context: { user: systemUser },
            },
          );
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

          await routerClient.bottles.update(
            {
              bottle: bottle.id,
              name: newName,
              brand: entity.id,
            },
            { context: { user: systemUser } },
          );
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
  .action(async (bottleIds, options) => {
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

    const releaseQuery = db
      .select({ id: bottleReleases.id })
      .from(bottleReleases)
      .where(
        bottleIds.length
          ? inArray(bottleReleases.bottleId, bottleIds)
          : undefined,
      )
      .orderBy(asc(bottleReleases.id));

    hasResults = true;
    offset = 0;
    while (hasResults) {
      hasResults = false;
      const query = await releaseQuery.offset(offset).limit(step);
      for (const { id } of query) {
        console.log(`Indexing search vectors for Bottle Release ${id}.`);
        await runJob("IndexBottleReleaseSearchVectors", { releaseId: id });
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
  .command("dump-repair-proposals")
  .description(
    "Dump high-confidence repair/backfill proposals across release, age, and canon queues",
  )
  .option(
    "--type <type>",
    "Comma-separated proposal types: release, age, canon, or all",
    "all",
  )
  .option("--format <format>", "Output format: summary or json", "summary")
  .option(
    "--limit <number>",
    "Maximum number of proposals to collect per type",
    "100",
  )
  .option("--query <query>", "Filter proposals by bottle name", "")
  .option(
    "--only-actionable",
    "Only include proposals that can be applied directly today",
  )
  .option(
    "--automation-only",
    "Only include the unattended-safe proposal subset",
  )
  .action(async (options) => {
    const perTypeLimit = Number.parseInt(options.limit, 10);
    if (!Number.isFinite(perTypeLimit) || perTypeLimit <= 0) {
      throw new Error(`Invalid limit: ${options.limit}`);
    }

    const types = parseRepairBackfillProposalTypes(options.type);
    const format = parseRepairBackfillProposalFormat(options.format);
    const result = await getRepairBackfillProposals({
      onlyAutomationEligible: Boolean(options.automationOnly),
      onlyActionable: Boolean(options.onlyActionable),
      perTypeLimit,
      query: options.query,
      types,
    });

    if (format === "json") {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(`Repair backfill proposals: ${result.summary.total}`);
    console.log(
      `Types: ${types.join(", ")} | Per-type limit: ${perTypeLimit} | Query: ${options.query || "(none)"}`,
    );
    console.log(
      `Automation: eligible=${result.summary.automationEligible}, blocked=${result.summary.automationBlocked}`,
    );
    console.log(
      `Actionability: apply=${result.summary.byActionability.apply}, blocked=${result.summary.byActionability.blocked}, manual=${result.summary.byActionability.manual}`,
    );
    console.log(
      `By type: release=${result.summary.byType.release}, age=${result.summary.byType.age}, canon=${result.summary.byType.canon}`,
    );
    console.log(
      `Release modes: existing_parent=${result.summary.byRepairMode.release.existing_parent}, create_parent=${result.summary.byRepairMode.release.create_parent}, blocked_classifier=${result.summary.byRepairMode.release.blocked_classifier}, blocked_alias_conflict=${result.summary.byRepairMode.release.blocked_alias_conflict}, blocked_dirty_parent=${result.summary.byRepairMode.release.blocked_dirty_parent}`,
    );
    console.log(
      `Release parent sources: heuristic_exact=${result.summary.byParentResolutionSource.release.heuristic_exact}, heuristic_variant=${result.summary.byParentResolutionSource.release.heuristic_variant}, classifier_review_persisted=${result.summary.byParentResolutionSource.release.classifier_review_persisted}, classifier_review_live=${result.summary.byParentResolutionSource.release.classifier_review_live}, none=${result.summary.byParentResolutionSource.release.none}`,
    );
    console.log(
      `Age modes: existing_release=${result.summary.byRepairMode.age.existing_release}, create_release=${result.summary.byRepairMode.age.create_release}`,
    );
    console.log(
      `Canon modes: review_required=${result.summary.byRepairMode.canon.review_required}`,
    );

    if (result.proposals.length === 0) {
      return;
    }

    console.log("");
    console.log("Top proposals:");
    for (const proposal of result.proposals.slice(0, 25)) {
      console.log(formatRepairBackfillProposalSummaryLine(proposal));
      console.log(`  ${proposal.adminHref}`);
    }

    if (result.proposals.length > 25) {
      console.log("");
      console.log(
        `... ${result.proposals.length - 25} more proposal(s) omitted. Use --format json for the full output.`,
      );
    }
  });

subcommand
  .command("review-release-repairs")
  .description(
    "Refresh persisted classifier reviews for heuristic create-parent release repairs",
  )
  .option(
    "--limit <number>",
    "Maximum number of create-parent release repairs to review",
    "100",
  )
  .option("--query <query>", "Filter repairs by bottle name", "")
  .action(async (options) => {
    const limit = Number.parseInt(options.limit, 10);
    if (!Number.isFinite(limit) || limit <= 0) {
      throw new Error(`Invalid limit: ${options.limit}`);
    }

    const pageSize = Math.min(limit, 100);
    let cursor = 1;
    let reviewed = 0;
    let scannedCreateParent = 0;
    const summary = {
      allow_create_parent: 0,
      blocked: 0,
      reuse_existing_parent: 0,
    };
    const blockedSummary = {
      classifier_review_failed: 0,
      classifier_exact_cask: 0,
      classifier_outside_parent_set: 0,
      classifier_dirty_parent_candidate: 0,
      classifier_unresolved_parent_decision: 0,
      other: 0,
    };

    while (reviewed < limit) {
      const page = await getHeuristicLegacyReleaseRepairCandidates({
        cursor,
        limit: pageSize,
        query: options.query,
      });

      if (page.results.length === 0) {
        break;
      }

      for (const candidate of page.results) {
        if (candidate.repairMode !== "create_parent") {
          continue;
        }

        scannedCreateParent += 1;
        const review = await refreshLegacyReleaseRepairReview({
          legacyBottleId: candidate.legacyBottle.id,
        });
        if (!review) {
          continue;
        }

        reviewed += 1;
        summary[review.resolution] += 1;
        if (review.resolution === "blocked") {
          blockedSummary[
            getLegacyReleaseRepairReviewBlockedReasonCategory(
              review.blockedReason,
            )
          ] += 1;
        }
        console.log(formatReleaseRepairReviewSummaryLine(candidate));
        console.log(
          `  reviewed=${review.resolution} parent=${review.reviewedParentBottleId ?? "(create)"} blocked=${review.blockedReason ?? "(none)"}`,
        );

        if (reviewed >= limit) {
          break;
        }
      }

      if (!page.rel.nextCursor) {
        break;
      }

      cursor = page.rel.nextCursor;
    }

    console.log(
      `Reviewed release repairs: ${reviewed} (scanned create_parent candidates: ${scannedCreateParent})`,
    );
    console.log(
      `reuse_existing_parent=${summary.reuse_existing_parent} allow_create_parent=${summary.allow_create_parent} blocked=${summary.blocked}`,
    );
    if (summary.blocked > 0) {
      console.log(
        `blocked reasons: classifier_review_failed=${blockedSummary.classifier_review_failed} classifier_exact_cask=${blockedSummary.classifier_exact_cask} classifier_outside_parent_set=${blockedSummary.classifier_outside_parent_set} classifier_dirty_parent_candidate=${blockedSummary.classifier_dirty_parent_candidate} classifier_unresolved_parent_decision=${blockedSummary.classifier_unresolved_parent_decision} other=${blockedSummary.other}`,
      );
    }
  });

subcommand
  .command("apply-repair-proposals")
  .description(
    "Preview or apply directly actionable release and age repair proposals in bulk",
  )
  .option(
    "--type <type>",
    "Comma-separated proposal types: release, age, or all",
    "all",
  )
  .option(
    "--limit <number>",
    "Maximum number of proposals to collect per type",
    "100",
  )
  .option("--query <query>", "Filter proposals by bottle name", "")
  .option(
    "--execute",
    "Actually apply the repair proposals. Without this flag the command only previews.",
  )
  .option(
    "--automation-only",
    "Only preview or apply the unattended-safe proposal subset",
  )
  .option(
    "--refresh-release-reviews",
    "Refresh persisted release reviews before collecting release proposals",
  )
  .action(async (options) => {
    const perTypeLimit = Number.parseInt(options.limit, 10);
    if (!Number.isFinite(perTypeLimit) || perTypeLimit <= 0) {
      throw new Error(`Invalid limit: ${options.limit}`);
    }

    const types = parseBatchApplicableRepairBackfillProposalTypes(options.type);
    const result = await applyRepairBackfillProposals({
      automationOnly: Boolean(options.automationOnly),
      dryRun: !options.execute,
      perTypeLimit,
      query: options.query,
      refreshReleaseReviews: Boolean(options.refreshReleaseReviews),
      types,
      user: options.execute ? await getAutomationModeratorUser() : undefined,
    });

    console.log(
      `${options.execute ? "Applied" : "Previewed"} repair proposals: ${result.summary.total}`,
    );
    console.log(
      `planned=${result.summary.planned} applied=${result.summary.applied} failed=${result.summary.failed}`,
    );

    for (const item of result.items) {
      console.log(
        `[${item.type}/${item.status}] ${item.bottleName} (${item.bottleId})`,
      );
      console.log(`  ${item.message}`);
    }

    if (options.execute && result.summary.failed > 0) {
      throw new Error(
        `${result.summary.failed} repair proposal(s) failed during execution.`,
      );
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
        const fullName = formatBottleName({
          ...bottle,
          name: `${brand.shortName || brand.name} ${bottle.name}`,
        });
        if (bottle.fullName !== fullName) {
          console.log(`Updating name for bottle ${bottle.id}: ${fullName}`);
          await db.transaction(async (tx) => {
            await tx
              .update(bottles)
              .set({ fullName })
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
