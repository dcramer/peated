import { and, asc, count, eq, inArray, isNull, sql } from "drizzle-orm";
import { readMigrationFiles } from "drizzle-orm/migrator";
import type { AnyPgTable } from "drizzle-orm/pg-core";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { db } from "../db";
import {
  bottleAliases,
  bottleGroups,
  bottleObservations,
  bottleReleasePromotions,
  bottleReleases,
  bottles,
  catalogTargets,
  reviews,
  tastings,
} from "../db/schema";
import type {
  CatalogMigrationRunReport,
  CatalogMigrationWriteApprovalInput,
} from "../schemas/catalogMigrationRun";
import {
  runCatalogMigrationDryRun,
  runCatalogMigrationWriteBatch,
} from "./catalogMigrationOrchestrator";

const GIT_REVISION = "a".repeat(40);
const OTHER_GIT_REVISION = "b".repeat(40);
const MIGRATIONS_FOLDER = __dirname + "/../../migrations";

function approvalFor(
  report: CatalogMigrationRunReport,
  approvedBy = "catalog-migration-test",
): CatalogMigrationWriteApprovalInput {
  return {
    approvedAt: new Date(
      Date.parse(report.evidence.generatedAt) + 1_000,
    ).toISOString(),
    approvedBy,
  };
}

async function tableCount(table: AnyPgTable) {
  const [row] = await db.select({ value: count() }).from(table);
  return row?.value ?? 0;
}

async function catalogSnapshot({
  parentId,
  releaseId,
  aliasNames,
  observationIds,
  reviewIds,
  tastingIds,
}: {
  parentId: number;
  releaseId?: number;
  aliasNames: string[];
  observationIds?: number[];
  reviewIds?: number[];
  tastingIds?: number[];
}) {
  return {
    parent: await db.query.bottles.findFirst({
      where: eq(bottles.id, parentId),
    }),
    release:
      releaseId === undefined
        ? null
        : await db.query.bottleReleases.findFirst({
            where: eq(bottleReleases.id, releaseId),
          }),
    aliases: await db
      .select()
      .from(bottleAliases)
      .where(inArray(bottleAliases.name, aliasNames))
      .orderBy(asc(bottleAliases.name)),
    observations:
      observationIds?.length === 0 || observationIds === undefined
        ? []
        : await db
            .select()
            .from(bottleObservations)
            .where(inArray(bottleObservations.id, observationIds))
            .orderBy(asc(bottleObservations.id)),
    reviews:
      reviewIds?.length === 0 || reviewIds === undefined
        ? []
        : await db
            .select()
            .from(reviews)
            .where(inArray(reviews.id, reviewIds))
            .orderBy(asc(reviews.id)),
    tastings:
      tastingIds?.length === 0 || tastingIds === undefined
        ? []
        : await db
            .select()
            .from(tastings)
            .where(inArray(tastings.id, tastingIds))
            .orderBy(asc(tastings.id)),
    groupCount: await tableCount(bottleGroups),
    targetCount: await tableCount(catalogTargets),
    promotionCount: await tableCount(bottleReleasePromotions),
  };
}

async function insertObservation({
  bottleId,
  releaseId = null,
  sourceKey,
  sourceName,
  rawText,
}: {
  bottleId: number;
  releaseId?: number | null;
  sourceKey: string;
  sourceName: string;
  rawText: string;
}) {
  const [row] = await db
    .insert(bottleObservations)
    .values({
      bottleId,
      releaseId,
      targetId: null,
      sourceType: "store_price",
      sourceKey,
      sourceName,
      sourceUrl: `https://example.test/${sourceKey}`,
      rawText,
      parsedIdentity: { sourceKey },
      facts: { abv: 51.2 },
      createdAt: new Date("2020-01-02T03:04:05.000Z"),
      updatedAt: new Date("2021-02-03T04:05:06.000Z"),
    })
    .returning();
  if (!row) throw new Error("Unable to create observation fixture.");
  return row;
}

async function migrationEvidence() {
  const candidate = readMigrationFiles({
    migrationsFolder: MIGRATIONS_FOLDER,
  }).at(-1);
  if (!candidate) throw new Error("Missing local migration fixture.");
  const databaseResult = await db.execute<{ databaseName: string }>(sql`
    SELECT current_database() AS "databaseName"
  `);
  const migrationResult = await db.execute<{
    id: number;
    hash: string;
    createdAt: string;
  }>(sql`
    SELECT id, hash, created_at AS "createdAt"
    FROM "__drizzle_migrations"
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `);
  const databaseName = databaseResult.rows[0]?.databaseName;
  const applied = migrationResult.rows[0];
  if (!databaseName || !applied) {
    throw new Error("Missing applied migration fixture.");
  }
  return { applied, candidate, databaseName };
}

async function exactTargetId(bottleId: number) {
  const target = await db.query.catalogTargets.findFirst({
    where: eq(catalogTargets.bottleId, bottleId),
  });
  if (!target) throw new Error(`Missing exact target for Bottle ${bottleId}.`);
  return target.id;
}

async function genericTargetId(groupId: number) {
  const target = await db.query.catalogTargets.findFirst({
    where: and(
      eq(catalogTargets.groupId, groupId),
      isNull(catalogTargets.bottleId),
    ),
  });
  if (!target) throw new Error(`Missing generic target for group ${groupId}.`);
  return target.id;
}

describe("catalog migration orchestrator", () => {
  test("produces exact dry-run evidence and never mutates catalog state", async ({
    fixtures,
  }) => {
    const parent = await fixtures.LegacyBottle({
      name: "Dry-run family",
      fullName: "Migration Brand Dry-run family",
    });
    const release = await fixtures.BottleRelease({
      bottleId: parent.id,
      name: "Dry-run release",
      fullName: "Migration Brand Dry-run release",
    });
    const alias = await fixtures.BottleAlias({
      bottleId: parent.id,
      releaseId: release.id,
      targetId: null,
      name: "Dry-run retained alias",
    });
    const review = await fixtures.Review({
      bottleId: parent.id,
      releaseId: release.id,
      targetId: null,
      name: "Dry-run retained review",
    });
    const before = await catalogSnapshot({
      parentId: parent.id,
      releaseId: release.id,
      aliasNames: [parent.fullName, alias.name],
      reviewIds: [review.id],
    });
    const expectedRevision = await migrationEvidence();

    const report = await runCatalogMigrationDryRun(
      { gitRevision: GIT_REVISION },
      db,
      MIGRATIONS_FOLDER,
    );

    expect(report).toMatchObject({
      schemaVersion: 1,
      mode: "dry_run",
      status: "complete",
      checkpoint: {
        afterParentId: 0,
        activeParentId: null,
        nextParentId: parent.id,
      },
      failure: null,
      writeApproval: null,
    });
    expect(report.evidence).toEqual({
      gitRevision: GIT_REVISION,
      databaseName: expectedRevision.databaseName,
      databaseMigration: {
        id: expectedRevision.applied.id,
        hash: expectedRevision.candidate.hash,
        createdAt: expectedRevision.candidate.folderMillis,
      },
      generatedAt: report.dryRunAudit.generatedAt,
    });
    expect(Number(expectedRevision.applied.createdAt)).toBe(
      expectedRevision.candidate.folderMillis,
    );
    expect(report.dryRunAudit).toMatchObject({
      databaseName: expectedRevision.databaseName,
      legacyCatalog: { totalParents: 1, totalReleases: 1 },
      promotionMappings: {
        tablePresent: true,
        totalLegacyReleases: 1,
        mappedReleases: 0,
      },
    });
    expect(report.metrics).toMatchObject({
      core: {
        familiesCreated: 0,
        familiesReused: 0,
        releasesCreated: 0,
        releasesReused: 0,
      },
    });
    expect(
      Object.values(report.metrics.consumerSlots).every(
        (slot) => slot.rows === 0 && slot.updated === 0 && slot.reused === 0,
      ),
    ).toBe(true);
    expect(
      await catalogSnapshot({
        parentId: parent.id,
        releaseId: release.id,
        aliasNames: [parent.fullName, alias.name],
        reviewIds: [review.id],
      }),
    ).toEqual(before);
  });

  test("coordinates a split family and a fresh rescan without duplicate business logic", async ({
    fixtures,
  }) => {
    const parent = await fixtures.LegacyBottle({
      name: "Coordinated family",
      fullName: "Migration Brand Coordinated family",
    });
    const release = await fixtures.BottleRelease({
      bottleId: parent.id,
      name: "Coordinated release",
      fullName: "Migration Brand Coordinated release",
      edition: "Retained edition",
      abv: 54.2,
    });
    const parentAlias = await fixtures.BottleAlias({
      bottleId: parent.id,
      releaseId: null,
      targetId: null,
      name: "Coordinated family stable alias",
      assignmentSource: "legacy",
    });
    const releaseAlias = await fixtures.BottleAlias({
      bottleId: parent.id,
      releaseId: release.id,
      targetId: null,
      name: "Coordinated release historical alias",
      ignored: true,
      assignmentSource: "human_approved",
    });
    const parentObservation = await insertObservation({
      bottleId: parent.id,
      sourceKey: "coordinated-family",
      sourceName: "Retained family listing",
      rawText: "retained generic observation",
    });
    const releaseObservation = await insertObservation({
      bottleId: parent.id,
      releaseId: release.id,
      sourceKey: "coordinated-release",
      sourceName: "Retained exact listing",
      rawText: "retained exact observation",
    });
    const genericReview = await fixtures.Review({
      bottleId: parent.id,
      releaseId: null,
      targetId: null,
      name: "Coordinated generic review",
      rating: 93,
      issue: "Retained issue",
      url: "https://example.test/coordinated-review",
    });
    const exactTasting = await fixtures.Tasting({
      bottleId: parent.id,
      releaseId: release.id,
      targetId: null,
      notes: "Retained tasting notes",
      tags: ["smoke", "fruit"],
      rating: 1,
      createdAt: new Date("2022-03-04T05:06:07.000Z"),
    });
    const retainedBefore = await catalogSnapshot({
      parentId: parent.id,
      releaseId: release.id,
      aliasNames: [parent.fullName, parentAlias.name, releaseAlias.name],
      observationIds: [parentObservation.id, releaseObservation.id],
      reviewIds: [genericReview.id],
      tastingIds: [exactTasting.id],
    });
    const dryRun = await runCatalogMigrationDryRun(
      { gitRevision: GIT_REVISION },
      db,
      MIGRATIONS_FOLDER,
    );
    const approval = approvalFor(dryRun);
    const checkpoints: CatalogMigrationRunReport[] = [];
    let capturedBeforeCore = false;

    const first = await runCatalogMigrationWriteBatch(
      {
        gitRevision: GIT_REVISION,
        approvedDryRun: dryRun,
        approval,
        limit: 1,
      },
      async (report) => {
        checkpoints.push(structuredClone(report));
        if (report.checkpoint.activeParentId === parent.id) {
          const stagedParent = await db.query.bottles.findFirst({
            where: eq(bottles.id, parent.id),
          });
          const mappings = await db
            .select()
            .from(bottleReleasePromotions)
            .where(eq(bottleReleasePromotions.releaseId, release.id));
          if (!capturedBeforeCore) {
            expect(stagedParent?.groupId).toBeNull();
            expect(mappings).toEqual([]);
            capturedBeforeCore = true;
          }
        }
      },
      db,
      MIGRATIONS_FOLDER,
    );

    expect(capturedBeforeCore).toBe(true);
    expect(checkpoints.map(({ status }) => status)).toEqual([
      "running",
      "complete",
    ]);
    expect(first).toMatchObject({
      mode: "write",
      status: "complete",
      checkpoint: {
        afterParentId: parent.id,
        activeParentId: null,
        nextParentId: null,
      },
      metrics: {
        core: {
          familiesCreated: 1,
          familiesReused: 0,
          releasesCreated: 1,
          releasesReused: 0,
        },
        aliases: { rows: 3, updated: 3, reused: 0 },
        observations: { rows: 2, updated: 2, reused: 0 },
      },
      failure: null,
    });
    expect(first.metrics.consumerSlots.tasting).toEqual({
      rows: 1,
      updated: 1,
      reused: 0,
    });
    expect(first.metrics.consumerSlots.review).toEqual({
      rows: 1,
      updated: 1,
      reused: 0,
    });
    expect(
      Object.entries(first.metrics.consumerSlots)
        .filter(([slot]) => slot !== "tasting" && slot !== "review")
        .every(([, counts]) => counts.rows === 0),
    ).toBe(true);

    const [mapping] = await db
      .select()
      .from(bottleReleasePromotions)
      .where(eq(bottleReleasePromotions.releaseId, release.id));
    if (!mapping?.promotedBottleId) {
      throw new Error("Missing completed release promotion.");
    }
    const exactTarget = await exactTargetId(mapping.promotedBottleId);
    const [promoted] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, mapping.promotedBottleId));
    if (!promoted?.groupId) throw new Error("Missing promoted Bottle group.");
    const genericTarget = await genericTargetId(promoted.groupId);
    expect(promoted).toMatchObject({
      edition: release.edition,
      abv: release.abv,
      fullName: release.fullName,
    });
    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, release.fullName),
      }),
    ).toMatchObject({
      bottleId: promoted.id,
      releaseId: null,
      targetId: exactTarget,
      assignmentSource: "canonical",
    });
    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, parentAlias.name),
      }),
    ).toEqual({ ...parentAlias, targetId: genericTarget });
    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, releaseAlias.name),
      }),
    ).toEqual({ ...releaseAlias, targetId: exactTarget });
    expect(
      await db.query.bottleObservations.findFirst({
        where: eq(bottleObservations.id, parentObservation.id),
      }),
    ).toEqual({ ...parentObservation, targetId: genericTarget });
    expect(
      await db.query.bottleObservations.findFirst({
        where: eq(bottleObservations.id, releaseObservation.id),
      }),
    ).toEqual({ ...releaseObservation, targetId: exactTarget });
    expect(
      await db.query.reviews.findFirst({
        where: eq(reviews.id, genericReview.id),
      }),
    ).toEqual({ ...genericReview, targetId: genericTarget });
    expect(
      await db.query.tastings.findFirst({
        where: eq(tastings.id, exactTasting.id),
      }),
    ).toEqual({ ...exactTasting, targetId: exactTarget });

    const graphCounts = {
      bottles: await tableCount(bottles),
      groups: await tableCount(bottleGroups),
      targets: await tableCount(catalogTargets),
      promotions: await tableCount(bottleReleasePromotions),
      aliases: await tableCount(bottleAliases),
    };
    expect(retainedBefore.groupCount).toBe(0);
    const freshDryRun = await runCatalogMigrationDryRun(
      { gitRevision: GIT_REVISION },
      db,
      MIGRATIONS_FOLDER,
    );
    const rescanned = await runCatalogMigrationWriteBatch(
      {
        gitRevision: GIT_REVISION,
        approvedDryRun: freshDryRun,
        approval: approvalFor(freshDryRun),
        limit: 1,
      },
      async () => undefined,
      db,
      MIGRATIONS_FOLDER,
    );

    expect(rescanned).toMatchObject({
      status: "complete",
      metrics: {
        core: {
          familiesCreated: 0,
          familiesReused: 1,
          releasesCreated: 0,
          releasesReused: 1,
        },
        aliases: { rows: 3, updated: 0, reused: 3 },
        observations: { rows: 2, updated: 0, reused: 2 },
      },
    });
    expect(rescanned.metrics.consumerSlots.tasting).toEqual({
      rows: 1,
      updated: 0,
      reused: 1,
    });
    expect(rescanned.metrics.consumerSlots.review).toEqual({
      rows: 1,
      updated: 0,
      reused: 1,
    });
    expect({
      bottles: await tableCount(bottles),
      groups: await tableCount(bottleGroups),
      targets: await tableCount(catalogTargets),
      promotions: await tableCount(bottleReleasePromotions),
      aliases: await tableCount(bottleAliases),
    }).toEqual(graphCounts);
  });

  test("resumes an active zero-release parent after a consumer conflict", async ({
    fixtures,
  }) => {
    const conflictedParent = await fixtures.LegacyBottle({
      name: "Interrupted parent",
      fullName: "Migration Brand Interrupted parent",
    });
    const nextParent = await fixtures.LegacyBottle({
      name: "Following parent",
      fullName: "Migration Brand Following parent",
    });
    const otherBottle = await fixtures.Bottle({
      name: "Unrelated grouped Bottle",
      fullName: "Migration Brand Unrelated grouped Bottle",
    });
    const otherTargetId = await exactTargetId(otherBottle.id);
    const conflictingReview = await fixtures.Review({
      bottleId: conflictedParent.id,
      releaseId: null,
      targetId: otherTargetId,
      name: "Conflicting retained review",
    });
    const dryRun = await runCatalogMigrationDryRun(
      { gitRevision: GIT_REVISION },
      db,
      MIGRATIONS_FOLDER,
    );
    const approval = approvalFor(dryRun);

    const failed = await runCatalogMigrationWriteBatch(
      {
        gitRevision: GIT_REVISION,
        approvedDryRun: dryRun,
        approval,
        limit: 2,
      },
      async () => undefined,
      db,
      MIGRATIONS_FOLDER,
    );

    expect(failed).toMatchObject({
      status: "failed",
      checkpoint: {
        afterParentId: 0,
        activeParentId: conflictedParent.id,
        nextParentId: nextParent.id,
      },
      failure: {
        phase: "consumers",
        parentId: conflictedParent.id,
        code: "target_conflict",
        retryable: false,
        releaseId: null,
        surface: "review",
        rowId: conflictingReview.id,
        projection: null,
      },
    });
    expect(
      await db.query.bottles.findFirst({
        where: eq(bottles.id, conflictedParent.id),
      }),
    ).toMatchObject({ groupId: expect.any(Number) });
    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, conflictedParent.fullName),
      }),
    ).toMatchObject({ targetId: expect.any(Number) });
    expect(
      await db.query.bottles.findFirst({
        where: eq(bottles.id, nextParent.id),
      }),
    ).toMatchObject({ groupId: null });

    await db
      .update(reviews)
      .set({ targetId: null })
      .where(eq(reviews.id, conflictingReview.id));
    const resumed = await runCatalogMigrationWriteBatch(
      {
        gitRevision: GIT_REVISION,
        approvedDryRun: dryRun,
        approval,
        report: failed,
        limit: 2,
      },
      async () => undefined,
      db,
      MIGRATIONS_FOLDER,
    );

    expect(resumed).toMatchObject({
      status: "complete",
      checkpoint: {
        afterParentId: nextParent.id,
        activeParentId: null,
        nextParentId: null,
      },
      failure: null,
      metrics: {
        core: {
          familiesCreated: 1,
          familiesReused: 1,
          releasesCreated: 0,
          releasesReused: 0,
        },
      },
    });
    expect(
      await db.query.reviews.findFirst({
        where: eq(reviews.id, conflictingReview.id),
      }),
    ).toEqual({
      ...conflictingReview,
      targetId: await exactTargetId(conflictedParent.id),
    });
    expect(
      await db
        .select({ bottleId: catalogTargets.bottleId })
        .from(catalogTargets)
        .where(
          inArray(catalogTargets.bottleId, [
            conflictedParent.id,
            nextParent.id,
          ]),
        )
        .orderBy(asc(catalogTargets.bottleId)),
    ).toEqual([{ bottleId: conflictedParent.id }, { bottleId: nextParent.id }]);
  });

  test("rejects non-later approval and changed candidate evidence without writes", async ({
    fixtures,
  }) => {
    const parent = await fixtures.LegacyBottle({
      name: "Approval-gated parent",
      fullName: "Migration Brand Approval-gated parent",
    });
    const dryRun = await runCatalogMigrationDryRun(
      { gitRevision: GIT_REVISION },
      db,
      MIGRATIONS_FOLDER,
    );
    const before = await catalogSnapshot({
      parentId: parent.id,
      aliasNames: [parent.fullName],
    });
    let checkpointCalls = 0;
    const checkpoint = async () => {
      checkpointCalls += 1;
    };

    await expect(
      runCatalogMigrationWriteBatch(
        {
          gitRevision: GIT_REVISION,
          approvedDryRun: dryRun,
          approval: {
            approvedAt: new Date(
              Date.parse(dryRun.evidence.generatedAt) - 1,
            ).toISOString(),
            approvedBy: "catalog-migration-test",
          },
          limit: 1,
        },
        checkpoint,
        db,
        MIGRATIONS_FOLDER,
      ),
    ).rejects.toThrow("Write approval must follow the approved dry run.");
    await expect(
      runCatalogMigrationWriteBatch(
        {
          gitRevision: GIT_REVISION,
          approvedDryRun: dryRun,
          approval: {
            approvedAt: dryRun.evidence.generatedAt,
            approvedBy: "catalog-migration-test",
          },
          limit: 1,
        },
        checkpoint,
        db,
        MIGRATIONS_FOLDER,
      ),
    ).rejects.toThrow("Write approval must follow the approved dry run.");
    await expect(
      runCatalogMigrationWriteBatch(
        {
          gitRevision: OTHER_GIT_REVISION,
          approvedDryRun: dryRun,
          approval: approvalFor(dryRun),
          limit: 1,
        },
        checkpoint,
        db,
        MIGRATIONS_FOLDER,
      ),
    ).rejects.toThrow(
      "The approved dry-run evidence does not match the write candidate.",
    );

    expect(checkpointCalls).toBe(0);
    expect(
      await catalogSnapshot({
        parentId: parent.id,
        aliasNames: [parent.fullName],
      }),
    ).toEqual(before);
  });

  test("rejects candidate migration drift before checkpoint or catalog writes", async ({
    fixtures,
  }) => {
    const parent = await fixtures.LegacyBottle({
      name: "Revision-gated parent",
      fullName: "Migration Brand Revision-gated parent",
    });
    const dryRun = await runCatalogMigrationDryRun(
      { gitRevision: GIT_REVISION },
      db,
      MIGRATIONS_FOLDER,
    );
    const before = await catalogSnapshot({
      parentId: parent.id,
      aliasNames: [parent.fullName],
    });
    const candidateFolder = await mkdtemp(
      join(tmpdir(), "peated-catalog-migration-"),
    );
    let checkpointCalls = 0;
    try {
      await mkdir(join(candidateFolder, "meta"));
      await writeFile(
        join(candidateFolder, "meta", "_journal.json"),
        `${JSON.stringify({
          version: "7",
          dialect: "pg",
          entries: [
            {
              idx: 0,
              version: "7",
              when: 1,
              tag: "0000_candidate_mismatch",
              breakpoints: false,
            },
          ],
        })}\n`,
      );
      await writeFile(
        join(candidateFolder, "0000_candidate_mismatch.sql"),
        "SELECT 1;\n",
      );

      await expect(
        runCatalogMigrationWriteBatch(
          {
            gitRevision: GIT_REVISION,
            approvedDryRun: dryRun,
            approval: approvalFor(dryRun),
            limit: 1,
          },
          async () => {
            checkpointCalls += 1;
          },
          db,
          candidateFolder,
        ),
      ).rejects.toMatchObject({
        name: "CatalogMigrationRevisionError",
        code: "migration_revision_mismatch",
      });
    } finally {
      await rm(candidateFolder, { recursive: true, force: true });
    }

    expect(checkpointCalls).toBe(0);
    expect(
      await catalogSnapshot({
        parentId: parent.id,
        aliasNames: [parent.fullName],
      }),
    ).toEqual(before);
  });

  test("stops after alias-observation conflict and resumes the active family", async ({
    fixtures,
  }) => {
    const parent = await fixtures.LegacyBottle({
      name: "Alias-observation interrupted parent",
      fullName: "Migration Brand Alias-observation interrupted parent",
    });
    const observation = await insertObservation({
      bottleId: parent.id,
      sourceKey: "alias-observation-conflict",
      sourceName: "Conflicting retained observation",
      rawText: "retained observation evidence",
    });
    const review = await fixtures.Review({
      bottleId: parent.id,
      releaseId: null,
      targetId: null,
      name: "Deferred consumer review",
    });
    const otherBottle = await fixtures.Bottle({
      name: "Unrelated conflict target",
      fullName: "Migration Brand Unrelated conflict target",
    });
    const otherTargetId = await exactTargetId(otherBottle.id);
    await db
      .update(bottleObservations)
      .set({ targetId: otherTargetId })
      .where(eq(bottleObservations.id, observation.id));
    const conflictingObservation = {
      ...observation,
      targetId: otherTargetId,
    };
    const dryRun = await runCatalogMigrationDryRun(
      { gitRevision: GIT_REVISION },
      db,
      MIGRATIONS_FOLDER,
    );
    const approval = approvalFor(dryRun);

    const failed = await runCatalogMigrationWriteBatch(
      {
        gitRevision: GIT_REVISION,
        approvedDryRun: dryRun,
        approval,
        limit: 1,
      },
      async () => undefined,
      db,
      MIGRATIONS_FOLDER,
    );

    expect(failed).toMatchObject({
      status: "failed",
      checkpoint: {
        afterParentId: 0,
        activeParentId: parent.id,
        nextParentId: null,
      },
      failure: {
        phase: "alias_observation",
        parentId: parent.id,
        code: "target_conflict",
        retryable: false,
        releaseId: null,
        table: "bottle_observation",
        rowId: observation.id,
      },
    });
    expect(
      await db.query.bottles.findFirst({ where: eq(bottles.id, parent.id) }),
    ).toMatchObject({ groupId: expect.any(Number) });
    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, parent.fullName),
      }),
    ).toMatchObject({ targetId: null });
    expect(
      await db.query.bottleObservations.findFirst({
        where: eq(bottleObservations.id, observation.id),
      }),
    ).toEqual(conflictingObservation);
    expect(
      await db.query.reviews.findFirst({ where: eq(reviews.id, review.id) }),
    ).toEqual(review);

    await db
      .update(bottleObservations)
      .set({ targetId: null })
      .where(eq(bottleObservations.id, observation.id));
    const resumed = await runCatalogMigrationWriteBatch(
      {
        gitRevision: GIT_REVISION,
        approvedDryRun: dryRun,
        approval,
        report: failed,
        limit: 1,
      },
      async () => undefined,
      db,
      MIGRATIONS_FOLDER,
    );
    const targetId = await exactTargetId(parent.id);

    expect(resumed).toMatchObject({
      status: "complete",
      checkpoint: {
        afterParentId: parent.id,
        activeParentId: null,
        nextParentId: null,
      },
      failure: null,
      metrics: {
        core: { familiesCreated: 0, familiesReused: 1 },
        aliases: { rows: 1, updated: 1, reused: 0 },
        observations: { rows: 1, updated: 1, reused: 0 },
      },
    });
    expect(
      await db.query.bottleObservations.findFirst({
        where: eq(bottleObservations.id, observation.id),
      }),
    ).toEqual({ ...observation, targetId });
    expect(
      await db.query.reviews.findFirst({ where: eq(reviews.id, review.id) }),
    ).toEqual({ ...review, targetId });
  });

  test("preserves the operation failure when its checkpoint also fails", async ({
    fixtures,
  }) => {
    const parent = await fixtures.LegacyBottle({
      name: "Composite failure parent",
      fullName: "Migration Brand Composite failure parent",
    });
    const observation = await insertObservation({
      bottleId: parent.id,
      sourceKey: "composite-checkpoint-failure",
      sourceName: "Composite checkpoint conflict",
      rawText: "retained composite failure evidence",
    });
    const review = await fixtures.Review({
      bottleId: parent.id,
      releaseId: null,
      targetId: null,
      name: "Consumer deferred by composite failure",
    });
    const otherBottle = await fixtures.Bottle({
      name: "Composite conflict target",
      fullName: "Migration Brand Composite conflict target",
    });
    const otherTargetId = await exactTargetId(otherBottle.id);
    await db
      .update(bottleObservations)
      .set({ targetId: otherTargetId })
      .where(eq(bottleObservations.id, observation.id));
    const dryRun = await runCatalogMigrationDryRun(
      { gitRevision: GIT_REVISION },
      db,
      MIGRATIONS_FOLDER,
    );
    let checkpointCalls = 0;

    const failed = await runCatalogMigrationWriteBatch(
      {
        gitRevision: GIT_REVISION,
        approvedDryRun: dryRun,
        approval: approvalFor(dryRun),
        limit: 1,
      },
      async () => {
        checkpointCalls += 1;
        if (checkpointCalls === 2) throw new Error("checkpoint unavailable");
      },
      db,
      MIGRATIONS_FOLDER,
    );

    expect(checkpointCalls).toBe(2);
    expect(failed).toMatchObject({
      status: "failed",
      checkpoint: {
        afterParentId: 0,
        activeParentId: parent.id,
        nextParentId: null,
      },
    });
    expect(failed.failure).toEqual({
      phase: "checkpoint",
      parentId: parent.id,
      code: "checkpoint_persist_failed",
      retryable: true,
      originalFailure: {
        phase: "alias_observation",
        parentId: parent.id,
        code: "target_conflict",
        retryable: false,
        releaseId: null,
        table: "bottle_observation",
        rowId: observation.id,
      },
    });
    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, parent.fullName),
      }),
    ).toMatchObject({ targetId: null });
    expect(
      await db.query.bottleObservations.findFirst({
        where: eq(bottleObservations.id, observation.id),
      }),
    ).toEqual({ ...observation, targetId: otherTargetId });
    expect(
      await db.query.reviews.findFirst({ where: eq(reviews.id, review.id) }),
    ).toEqual(review);
  });

  test("replays committed phases after the advanced checkpoint fails", async ({
    fixtures,
  }) => {
    const parent = await fixtures.LegacyBottle({
      name: "Checkpoint replay parent",
      fullName: "Migration Brand Checkpoint replay parent",
    });
    const dryRun = await runCatalogMigrationDryRun(
      { gitRevision: GIT_REVISION },
      db,
      MIGRATIONS_FOLDER,
    );
    const approval = approvalFor(dryRun);
    let priorActive: CatalogMigrationRunReport | null = null;
    let checkpointCalls = 0;

    const failed = await runCatalogMigrationWriteBatch(
      {
        gitRevision: GIT_REVISION,
        approvedDryRun: dryRun,
        approval,
        limit: 1,
      },
      async (report) => {
        checkpointCalls += 1;
        if (checkpointCalls === 1) {
          priorActive = structuredClone(report);
          return;
        }
        throw new Error("checkpoint unavailable");
      },
      db,
      MIGRATIONS_FOLDER,
    );

    expect(checkpointCalls).toBe(2);
    expect(priorActive).not.toBeNull();
    expect(failed).toEqual({
      ...priorActive!,
      status: "failed",
      failure: {
        phase: "checkpoint",
        parentId: parent.id,
        code: "checkpoint_persist_failed",
        retryable: true,
      },
    });
    const committedGraph = {
      bottles: await tableCount(bottles),
      groups: await tableCount(bottleGroups),
      targets: await tableCount(catalogTargets),
      aliases: await tableCount(bottleAliases),
      promotions: await tableCount(bottleReleasePromotions),
    };
    expect(committedGraph).toEqual({
      bottles: 1,
      groups: 1,
      targets: 2,
      aliases: 1,
      promotions: 0,
    });

    const replayed = await runCatalogMigrationWriteBatch(
      {
        gitRevision: GIT_REVISION,
        approvedDryRun: dryRun,
        approval,
        report: failed,
        limit: 1,
      },
      async () => undefined,
      db,
      MIGRATIONS_FOLDER,
    );

    expect(replayed).toMatchObject({
      status: "complete",
      checkpoint: {
        afterParentId: parent.id,
        activeParentId: null,
        nextParentId: null,
      },
      failure: null,
      metrics: {
        core: {
          familiesCreated: 0,
          familiesReused: 1,
          releasesCreated: 0,
          releasesReused: 0,
        },
        aliases: { rows: 1, updated: 0, reused: 1 },
      },
    });
    expect({
      bottles: await tableCount(bottles),
      groups: await tableCount(bottleGroups),
      targets: await tableCount(catalogTargets),
      aliases: await tableCount(bottleAliases),
      promotions: await tableCount(bottleReleasePromotions),
    }).toEqual(committedGraph);
    expect(
      await db
        .select({ name: bottleAliases.name })
        .from(bottleAliases)
        .where(eq(bottleAliases.name, parent.fullName)),
    ).toEqual([{ name: parent.fullName }]);
  });
});
