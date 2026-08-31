import { db } from "@peated/server/db";
import { bottleReferences, bottleTombstones } from "@peated/server/db/schema";
import {
  assertBottleReferenceMigrationReportsMatch,
  getBottleReferenceMigrationReport,
} from "@peated/server/lib/bottleReferenceMigrationAudit";
import { eq } from "drizzle-orm";

describe("BottleReference migration audit", () => {
  test("reports identity, coverage, normalization, and retired assignments", async ({
    fixtures,
  }) => {
    const canonicalBottle = await fixtures.Bottle({
      fullName: "Migration Audit Canonical",
    });
    const missingBottle = await fixtures.Bottle({
      fullName: "Migration Audit Missing",
    });
    const retiredBottle = await fixtures.Bottle({
      fullName: "Migration Audit Retired",
    });
    const replacementBottle = await fixtures.Bottle();
    await db
      .delete(bottleReferences)
      .where(eq(bottleReferences.bottleId, missingBottle.id));
    await db.insert(bottleTombstones).values({
      bottleId: retiredBottle.id,
      newBottleId: replacementBottle.id,
    });
    await db.insert(bottleReferences).values([
      {
        name: "Migration   Audit Variant",
        bottleId: canonicalBottle.id,
        assignmentSource: "human_approved",
        assignedByActorId: canonicalBottle.createdByActorId,
      },
      {
        name: "Migration Audit Variant",
        bottleId: canonicalBottle.id,
        assignmentSource: "source_approved",
        assignedByActorId: canonicalBottle.createdByActorId,
      },
      {
        name: "Migration Audit Unresolved",
        bottleId: null,
        assignedByActorId: canonicalBottle.createdByActorId,
      },
      {
        name: "Migration Audit Ignored",
        bottleId: null,
        ignored: true,
        assignedByActorId: canonicalBottle.createdByActorId,
      },
      {
        name: "Migration Audit Retired Reference",
        bottleId: retiredBottle.id,
        assignedByActorId: canonicalBottle.createdByActorId,
      },
    ]);

    const report = await getBottleReferenceMigrationReport();

    expect(report.totals).toMatchObject({
      assigned: 6,
      unresolved: 2,
      ignored: 1,
      retiredAssigned: 2,
    });
    expect(report.byAssignmentSource).toMatchObject({
      canonical: 3,
      human_approved: 1,
      source_approved: 1,
    });
    expect(report.canonicalCoverage.coveredBottles).toBeGreaterThanOrEqual(1);
    expect(report.canonicalCoverage.missingBottleIds).toContain(
      missingBottle.id,
    );
    expect(report.collisions.caseInsensitive).toBe(0);
    expect(report.collisions.normalizedExamples).toContainEqual([
      "Migration   Audit Variant",
      "Migration Audit Variant",
    ]);
    expect(report.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  test("accepts only an identical postflight identity", async ({
    fixtures,
  }) => {
    await fixtures.BottleReference({ name: "Stable Migration Identity" });
    const expected = await getBottleReferenceMigrationReport();
    const actual = await getBottleReferenceMigrationReport();

    expect(() =>
      assertBottleReferenceMigrationReportsMatch(expected, actual),
    ).not.toThrow();
    expect(() =>
      assertBottleReferenceMigrationReportsMatch(expected, {
        ...actual,
        fingerprint: "changed",
      }),
    ).toThrow("postflight does not match preflight");
  });
});
