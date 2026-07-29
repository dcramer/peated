import { eq } from "drizzle-orm";
import { db } from "../db";
import {
  bottleAliases,
  bottleReleasePromotions,
  bottles,
  bottleTombstones,
} from "../db/schema";
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
      retiredParents: 0,
      retiredParentsWithReleases: 0,
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
      validMappings: 0,
      invalidMappings: 0,
    });
    expect(report.blockingIssueCount).toBe(0);
    expect(report.warningCount).toBe(0);
  });

  test("reports a retired zero-release parent without blocking migration", async ({
    fixtures,
  }) => {
    const retired = await fixtures.LegacyBottle();
    await db.insert(bottleTombstones).values({ bottleId: retired.id });

    const report = await runCatalogMigrationAudit();

    expect(report.legacyCatalog).toMatchObject({
      totalParents: 0,
      parentsWithZeroReleases: 0,
      parentsWithOneRelease: 0,
      parentsWithMultipleReleases: 0,
      retiredParents: 1,
      retiredParentsWithReleases: 0,
      totalReleases: 0,
    });
    expect(report.blockingIssueCount).toBe(0);
    expect(
      await db.query.bottleTombstones.findFirst({
        where: eq(bottleTombstones.bottleId, retired.id),
      }),
    ).toMatchObject({ bottleId: retired.id });
  });

  test("blocks a retired parent that still owns a legacy release", async ({
    fixtures,
  }) => {
    const retired = await fixtures.LegacyBottle();
    const release = await fixtures.BottleRelease({
      bottleId: retired.id,
      name: `${retired.name} retired release`,
      fullName: `${retired.fullName} retired release`,
    });
    await db.insert(bottleTombstones).values({ bottleId: retired.id });

    const report = await runCatalogMigrationAudit();

    expect(report.legacyCatalog).toMatchObject({
      totalParents: 0,
      parentsWithZeroReleases: 0,
      parentsWithOneRelease: 0,
      parentsWithMultipleReleases: 0,
      retiredParents: 1,
      retiredParentsWithReleases: 1,
      totalReleases: 1,
    });
    expect(report.blockingIssueCount).toBe(1);
    expect(
      await db.query.bottleTombstones.findFirst({
        where: eq(bottleTombstones.bottleId, retired.id),
      }),
    ).toMatchObject({ bottleId: retired.id });
    expect(
      await db.query.bottleReleases.findFirst({
        where: (releases, { eq }) => eq(releases.id, release.id),
      }),
    ).toMatchObject({ id: release.id, bottleId: retired.id });
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
          type: "release_full_name_vs_bottle",
          name: parent.fullName,
          bottleId: parent.id,
        }),
      ]),
    );
    expect(report.blockingIssueCount).toBe(1);
    expect(report.warningCount).toBeGreaterThanOrEqual(2);
  });

  test("treats Bottle-owned exact fields and same-family aliases as warnings", async ({
    fixtures,
  }) => {
    const parent = await fixtures.LegacyBottle({
      edition: "Legacy Edition",
      statedAge: 10,
    });
    const release = await fixtures.BottleRelease({
      bottleId: parent.id,
      fullName: `${parent.fullName} 12 Year`,
      statedAge: 12,
    });
    await db.insert(bottleAliases).values({
      bottleId: parent.id,
      name: release.fullName,
      assignedByActorId: parent.createdByActorId,
    });

    const report = await runCatalogMigrationAudit();

    expect(report.legacyCatalog.parentsWithReleaseLikeFields).toBe(1);
    expect(report.legacyCatalog.childParentAgeConflicts).toBe(1);
    expect(report.collisions).toEqual({ count: 0, items: [] });
    expect(report.blockingIssueCount).toBe(0);
    expect(report.warningCount).toBeGreaterThanOrEqual(2);
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

  test("distinguishes complete, duplicate, and dangling mappings", () => {
    expect(
      summarizePromotionMappings({
        tablePresent: true,
        totalLegacyReleases: 6,
        rows: [
          {
            releaseId: 1,
            promotedBottleId: 101,
            legacyReleaseExists: true,
            promotedBottleExists: true,
          },
          {
            releaseId: 1,
            promotedBottleId: 102,
            legacyReleaseExists: true,
            promotedBottleExists: true,
          },
          {
            releaseId: 2,
            promotedBottleId: 103,
            legacyReleaseExists: false,
            promotedBottleExists: false,
          },
          {
            releaseId: 3,
            promotedBottleId: 104,
            legacyReleaseExists: true,
            promotedBottleExists: false,
          },
        ],
      }),
    ).toEqual({
      tablePresent: true,
      totalLegacyReleases: 6,
      totalMappings: 4,
      mappedReleases: 1,
      unmappedReleases: 5,
      validMappings: 2,
      invalidMappings: 2,
      duplicateReleaseMappings: 1,
      missingLegacyReleases: 1,
      missingPromotedBottles: 2,
    });
  });

  test("reports unmapped releases before apply", async ({ fixtures }) => {
    const parent = await fixtures.LegacyBottle();
    await fixtures.BottleRelease({
      bottleId: parent.id,
      name: `${parent.name} unmapped`,
      fullName: `${parent.fullName} unmapped`,
    });

    const report = await runCatalogMigrationAudit();

    expect(report.promotionMappings).toMatchObject({
      totalMappings: 0,
      mappedReleases: 0,
      unmappedReleases: 1,
      validMappings: 0,
      invalidMappings: 0,
    });
    expect(report.blockingIssueCount).toBe(0);
  });

  test("does not report a mapped promotion as its own collision", async ({
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
    });
    await fixtures.Tasting({
      bottleId: promoted.id,
      releaseId: release.id,
      tags: [],
    });

    const completedReport = await runCatalogMigrationAudit();

    expect(completedReport.legacyCatalog.totalParents).toBe(1);
    expect(completedReport.promotionMappings).toMatchObject({
      mappedReleases: 1,
      validMappings: 1,
    });
    expect(
      completedReport.references.find(({ surface }) => surface === "tastings"),
    ).toMatchObject({
      releaseRows: 1,
      mismatchedPairs: 0,
      invalidRows: 0,
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

    expect(output).toContain("Catalog migration audit v6");
    expect(output).toContain(
      "Parents: 1 (1 zero / 0 one / 0 multiple releases)",
    );
    expect(output).toContain("Retired parents: 0 (0 with releases)");
    expect(output).toContain(
      "Promotion mappings: present (0/0 mapped; 0 invalid)",
    );
  });
});
