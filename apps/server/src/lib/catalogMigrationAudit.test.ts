import { eq } from "drizzle-orm";
import { db } from "../db";
import { bottleAliases, bottleReleasePromotions, bottles } from "../db/schema";
import {
  formatCatalogMigrationAudit,
  runCatalogMigrationAudit,
  summarizePromotionMappings,
} from "./catalogMigrationAudit";

describe("catalog migration audit", () => {
  test("reports a clean parent and release deterministically", async ({
    fixtures,
  }) => {
    const parent = await fixtures.LegacyBottle({
      imageUrl: "https://peated.test/parent.jpg",
      statedAge: 12,
    });
    const release = await fixtures.BottleRelease({
      bottleId: parent.id,
      edition: "2026 Release",
      fullName: `${parent.fullName} 2026 Release`,
      name: `${parent.name} 2026 Release`,
      imageUrl: "https://peated.test/release.jpg",
      statedAge: 12,
    });
    await db.insert(bottleAliases).values({
      bottleId: parent.id,
      releaseId: release.id,
      name: release.fullName,
      assignedByActorId: parent.createdByActorId,
    });

    const report = await runCatalogMigrationAudit();

    expect(report.legacyCatalog).toMatchObject({
      totalParents: 1,
      parentsWithZeroReleases: 0,
      parentsWithOneRelease: 1,
      parentsWithMultipleReleases: 0,
      totalReleases: 1,
      parentsWithReleaseLikeFields: 0,
      childParentAgeConflicts: 0,
      orphanReleases: 0,
      missingParentCreators: 0,
      missingReleaseCreators: 0,
      missingParentAliases: 0,
      missingReleaseAliases: 0,
      missingParentImages: 0,
      missingReleaseImages: 0,
    });
    expect(report.collisions).toEqual({ count: 0, items: [] });
    expect(report.references).toHaveLength(12);
    expect(report.references).toContainEqual({
      surface: "flights",
      totalRows: 0,
      genericRows: 0,
      releaseRows: 0,
      unassignedRows: 0,
      missingBottleReferences: 0,
      missingReleaseReferences: 0,
      mismatchedPairs: 0,
      invalidRows: 0,
    });
    expect(report.promotionMappings).toMatchObject({
      tablePresent: true,
      totalLegacyReleases: 1,
      totalMappings: 0,
      mappedReleases: 0,
      unmappedReleases: 1,
      completedMappings: 0,
      pendingMappings: 0,
      failedMappings: 0,
      partialMappings: 0,
      invalidStatusMappings: 0,
    });
    expect(report.blockingIssueCount).toBe(0);
    expect(report.warningCount).toBe(0);
  });

  test("reports release-like parent fields, age conflicts, and name collisions", async ({
    fixtures,
  }) => {
    const parent = await fixtures.LegacyBottle({
      edition: "Batch 1",
      statedAge: 10,
    });
    await fixtures.BottleRelease({
      bottleId: parent.id,
      fullName: parent.fullName,
      statedAge: 12,
    });

    const report = await runCatalogMigrationAudit();

    expect(report.legacyCatalog.parentsWithReleaseLikeFields).toBe(1);
    expect(report.legacyCatalog.childParentAgeConflicts).toBe(1);
    expect(report.collisions.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "release_full_name_vs_alias",
          name: parent.fullName,
        }),
        expect.objectContaining({
          type: "release_full_name_vs_bottle",
          name: parent.fullName,
          bottleId: parent.id,
        }),
      ]),
    );
    expect(report.blockingIssueCount).toBeGreaterThanOrEqual(4);
  });

  test("reports missing release promotion inputs", async ({ fixtures }) => {
    const parent = await fixtures.LegacyBottle();
    await fixtures.BottleRelease({ bottleId: parent.id });

    const report = await runCatalogMigrationAudit();

    expect(report.legacyCatalog).toMatchObject({
      missingParentAliases: 0,
      missingReleaseAliases: 1,
      missingParentImages: 1,
      missingReleaseImages: 1,
    });
    expect(report.warningCount).toBe(3);
  });

  test("reports invalid Bottle and release pairs on consumer rows", async ({
    fixtures,
  }) => {
    const releaseParent = await fixtures.LegacyBottle();
    const release = await fixtures.BottleRelease({
      bottleId: releaseParent.id,
    });
    const mismatchedParent = await fixtures.LegacyBottle();
    await fixtures.Tasting({
      bottleId: mismatchedParent.id,
      releaseId: release.id,
    });

    const report = await runCatalogMigrationAudit();
    const tastingReferences = report.references.find(
      (reference) => reference.surface === "tastings",
    );

    expect(tastingReferences).toMatchObject({
      totalRows: 1,
      releaseRows: 1,
      mismatchedPairs: 1,
      invalidRows: 1,
    });
    expect(report.blockingIssueCount).toBeGreaterThanOrEqual(1);
  });

  test("distinguishes completed, pending, failed, partial, and invalid mappings", () => {
    expect(
      summarizePromotionMappings({
        tablePresent: true,
        totalLegacyReleases: 6,
        rows: [
          {
            releaseId: 1,
            promotedBottleId: 101,
            status: "promoted",
            completedAt: new Date("2026-01-01T00:00:00.000Z"),
            error: null,
            legacyReleaseExists: true,
            promotedBottleExists: true,
          },
          {
            releaseId: 1,
            promotedBottleId: 102,
            status: "pending",
            completedAt: null,
            error: null,
            legacyReleaseExists: true,
            promotedBottleExists: true,
          },
          {
            releaseId: 2,
            promotedBottleId: 103,
            status: "failed",
            completedAt: null,
            error: "promotion failed",
            legacyReleaseExists: false,
            promotedBottleExists: false,
          },
          {
            releaseId: 3,
            promotedBottleId: null,
            status: "promoted",
            completedAt: null,
            error: null,
            legacyReleaseExists: true,
            promotedBottleExists: false,
          },
          {
            releaseId: 4,
            promotedBottleId: null,
            status: "unexpected",
            completedAt: null,
            error: null,
            legacyReleaseExists: true,
            promotedBottleExists: false,
          },
        ],
      }),
    ).toEqual({
      tablePresent: true,
      totalLegacyReleases: 6,
      totalMappings: 5,
      mappedReleases: 1,
      unmappedReleases: 5,
      completedMappings: 1,
      pendingMappings: 1,
      failedMappings: 1,
      partialMappings: 1,
      invalidStatusMappings: 1,
      duplicateReleaseMappings: 1,
      missingLegacyReleases: 1,
      missingPromotedBottles: 3,
    });
  });

  test("reports incomplete mapping statuses as blockers", async ({
    fixtures,
  }) => {
    const parent = await fixtures.LegacyBottle();
    const pending = await fixtures.BottleRelease({ bottleId: parent.id });
    const failed = await fixtures.BottleRelease({ bottleId: parent.id });
    const partial = await fixtures.BottleRelease({ bottleId: parent.id });
    const promoted = await fixtures.Bottle();

    await db.insert(bottleReleasePromotions).values([
      {
        releaseId: pending.id,
        status: "pending",
        startedAt: new Date(),
      },
      {
        releaseId: failed.id,
        status: "failed",
        error: "fixture failure",
      },
      {
        releaseId: partial.id,
        promotedBottleId: promoted.id,
        status: "promoted",
      },
    ]);

    const report = await runCatalogMigrationAudit();

    expect(report.promotionMappings).toMatchObject({
      totalMappings: 3,
      mappedReleases: 0,
      unmappedReleases: 3,
      completedMappings: 0,
      pendingMappings: 1,
      failedMappings: 1,
      partialMappings: 1,
      invalidStatusMappings: 0,
    });
    expect(report.blockingIssueCount).toBeGreaterThanOrEqual(3);
  });

  test("does not report a completed promotion as its own collision", async ({
    fixtures,
  }) => {
    const parent = await fixtures.LegacyBottle();
    const release = await fixtures.BottleRelease({
      bottleId: parent.id,
      name: "Completed promotion",
      fullName: "Migration Brand Completed promotion",
    });
    const promoted = await fixtures.Bottle({
      name: release.name,
      fullName: release.fullName,
    });
    await db.insert(bottleReleasePromotions).values({
      releaseId: release.id,
      promotedBottleId: promoted.id,
      status: "promoted",
      startedAt: new Date("2026-01-01T00:00:00.000Z"),
      completedAt: new Date("2026-01-01T00:00:01.000Z"),
    });

    const completedReport = await runCatalogMigrationAudit();

    expect(completedReport.promotionMappings).toMatchObject({
      mappedReleases: 1,
      completedMappings: 1,
    });
    expect(
      completedReport.collisions.items.filter(
        ({ releaseId }) => releaseId === release.id,
      ),
    ).toEqual([]);

    const conflict = await fixtures.Bottle({
      name: "Different identity",
      fullName: "Migration Brand Different identity",
    });
    await db
      .update(bottles)
      .set({ fullName: release.fullName })
      .where(eq(bottles.id, conflict.id));

    const conflictingReport = await runCatalogMigrationAudit();

    expect(conflictingReport.collisions.items).toContainEqual(
      expect.objectContaining({
        type: "release_full_name_vs_bottle",
        releaseId: release.id,
        bottleId: conflict.id,
      }),
    );
    expect(
      conflictingReport.collisions.items.some(
        ({ releaseId, bottleId }) =>
          releaseId === release.id && bottleId === promoted.id,
      ),
    ).toBe(false);
  });

  test("formats the same report for human-readable CLI output", async ({
    fixtures,
  }) => {
    await fixtures.LegacyBottle();

    const output = formatCatalogMigrationAudit(
      await runCatalogMigrationAudit(),
    );

    expect(output).toContain("Catalog migration audit v2");
    expect(output).toContain(
      "Parents: 1 (1 zero / 0 one / 0 multiple releases)",
    );
    expect(output).toContain(
      "Promotion mappings: present (0/0 completed; 0 pending / 0 failed / 0 partial / 0 invalid status)",
    );
  });
});
