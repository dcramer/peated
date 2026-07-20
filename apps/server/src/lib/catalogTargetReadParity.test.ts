import { db } from "@peated/server/db";
import {
  bottleGroupTombstones,
  bottleReleasePromotions,
  bottles,
  bottleTombstones,
  catalogTargets,
} from "@peated/server/db/schema";
import {
  CatalogTargetNotFoundError,
  CatalogTargetRetiredError,
  loadCatalogTarget,
  loadCatalogTargetBatch,
} from "@peated/server/lib/catalogTargets";
import { eq } from "drizzle-orm";
import {
  loadCatalogTargetReadsWithParity,
  recordCatalogTargetReadFilterParity,
} from "./catalogTargetReadParity";

const readContext = {
  actor: null,
  permissions: { canReadCatalogIdentity: true },
  caller: "catalogTargetReadParity.test",
  operation: "serialize",
} as const;

async function exactTargetId(bottleId: number): Promise<number> {
  const target = await db.query.catalogTargets.findFirst({
    where: eq(catalogTargets.bottleId, bottleId),
  });
  if (!target) throw new Error("Missing exact target fixture");
  return target.id;
}

async function genericTargetId(groupId: number): Promise<number> {
  const target = await db.query.catalogTargets.findFirst({
    where: (table, { and, eq, isNull }) =>
      and(eq(table.groupId, groupId), isNull(table.bottleId)),
  });
  if (!target) throw new Error("Missing generic target fixture");
  return target.id;
}

describe("CatalogTarget read parity", () => {
  test("retains per-target batch resolution when one target is missing", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const targetId = await exactTargetId(bottle.id);

    const results = await loadCatalogTargetBatch(
      [targetId, 999_999],
      readContext,
    );

    expect(results.get(targetId)).toMatchObject({
      ok: true,
      target: { kind: "bottle", bottle: { id: bottle.id } },
    });
    expect(results.get(999_999)).toMatchObject({
      ok: false,
      error: expect.any(CatalogTargetNotFoundError),
    });

    await expect(
      loadCatalogTargetBatch([], {
        actor: null,
        permissions: { canReadCatalogIdentity: false },
      }),
    ).rejects.toThrow("Catalog identity read permission is required");
  });

  test("batch-loads group and Bottle retirement replacements", async ({
    fixtures,
  }) => {
    const groupRetired = await fixtures.Bottle();
    const bottleRetired = await fixtures.Bottle();
    const groupReplacement = await fixtures.Bottle();
    const bottleReplacement = await fixtures.Bottle();
    await db.insert(bottleGroupTombstones).values({
      groupId: groupRetired.groupId as number,
      newGroupId: groupReplacement.groupId as number,
      createdByActorId: groupRetired.createdByActorId,
    });
    await db.insert(bottleTombstones).values({
      bottleId: bottleRetired.id,
      newBottleId: bottleReplacement.id,
    });
    await db.insert(bottleTombstones).values({
      bottleId: groupRetired.id,
      newBottleId: bottleReplacement.id,
    });
    const groupTargetId = await exactTargetId(groupRetired.id);
    const bottleTargetId = await exactTargetId(bottleRetired.id);

    const results = await loadCatalogTargetBatch(
      [groupTargetId, bottleTargetId],
      readContext,
    );

    expect(results.get(groupTargetId)).toMatchObject({
      ok: false,
      error: {
        code: "CATALOG_TARGET_RETIRED",
        identity: { groupId: groupRetired.groupId },
        replacement: {
          kind: "group",
          groupId: groupReplacement.groupId,
        },
      },
    });
    expect(results.get(bottleTargetId)).toMatchObject({
      ok: false,
      error: {
        code: "CATALOG_TARGET_RETIRED",
        identity: { bottleId: bottleRetired.id },
        replacement: { kind: "bottle", bottleId: bottleReplacement.id },
      },
    });
    await expect(
      loadCatalogTarget(groupTargetId, readContext),
    ).rejects.toMatchObject({
      code: "CATALOG_TARGET_RETIRED",
      identity: { groupId: groupRetired.groupId },
      replacement: {
        kind: "group",
        groupId: groupReplacement.groupId,
      },
    });
  });

  test("returns exact, generic, and promoted-release targets with parity", async ({
    fixtures,
  }) => {
    const exactBottle = await fixtures.Bottle();
    const genericParent = await fixtures.Bottle();
    await fixtures.BottleRelease({ bottleId: genericParent.id });
    const promotionParent = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({
      bottleId: promotionParent.id,
    });
    const [promotedBottle] = await db
      .insert(bottles)
      .values({
        groupId: promotionParent.groupId,
        brandId: promotionParent.brandId,
        name: `${promotionParent.name} promoted`,
        fullName: `${promotionParent.fullName} promoted`,
        createdByActorId: promotionParent.createdByActorId,
      })
      .returning();
    if (!promotedBottle) throw new Error("Missing promoted Bottle fixture");
    const [promotedTarget] = await db
      .insert(catalogTargets)
      .values({
        groupId: promotionParent.groupId as number,
        bottleId: promotedBottle.id,
      })
      .returning();
    if (!promotedTarget) throw new Error("Missing promoted target fixture");
    await db.insert(bottleReleasePromotions).values({
      releaseId: release.id,
      promotedBottleId: promotedBottle.id,
      status: "promoted",
      completedAt: new Date(),
      createdByActorId: promotionParent.createdByActorId,
    });

    const result = await loadCatalogTargetReadsWithParity(
      [
        {
          consumerTable: "tasting",
          rowLocator: { id: 1 },
          targetId: await exactTargetId(exactBottle.id),
          legacy: { bottleId: exactBottle.id, releaseId: null },
        },
        {
          consumerTable: "review",
          rowLocator: { id: 2 },
          targetId: await genericTargetId(genericParent.groupId as number),
          legacy: { bottleId: genericParent.id, releaseId: null },
        },
        {
          consumerTable: "review",
          rowLocator: { id: 3 },
          targetId: promotedTarget.id,
          legacy: { bottleId: promotionParent.id, releaseId: release.id },
        },
      ],
      readContext,
    );

    expect(result.mismatches).toEqual([]);
    expect(result.targets).toMatchObject([
      { kind: "bottle", bottle: { id: exactBottle.id } },
      { kind: "group", group: { id: genericParent.groupId } },
      { kind: "bottle", bottle: { id: promotedBottle.id } },
    ]);
  });

  test("returns actionable, sanitized mismatch evidence", async ({
    fixtures,
  }) => {
    const targetBottle = await fixtures.Bottle();
    const otherBottle = await fixtures.Bottle();
    const otherRelease = await fixtures.BottleRelease({
      bottleId: otherBottle.id,
    });
    const targetId = await exactTargetId(targetBottle.id);

    const result = await loadCatalogTargetReadsWithParity(
      [
        {
          consumerTable: "tasting",
          rowLocator: { id: 41 },
          targetId,
          legacy: { bottleId: otherBottle.id, releaseId: null },
        },
        {
          consumerTable: "review",
          rowLocator: { id: 42 },
          targetId,
          legacy: {
            bottleId: targetBottle.id,
            releaseId: otherRelease.id,
          },
        },
      ],
      readContext,
    );

    expect(result.targets).toMatchObject([
      { kind: "bottle", bottle: { id: targetBottle.id } },
      { kind: "bottle", bottle: { id: targetBottle.id } },
    ]);
    expect(result.mismatches).toEqual([
      expect.objectContaining({
        consumerTable: "tasting",
        rowLocator: { id: 41 },
        legacyBottleId: otherBottle.id,
        legacyReleaseId: null,
        targetId,
        targetResolution: expect.objectContaining({
          status: "resolved",
          bottleId: targetBottle.id,
        }),
        legacyResolution: expect.objectContaining({
          status: "resolved",
          kind: "group",
          groupId: otherBottle.groupId,
          bottleId: null,
        }),
      }),
      expect.objectContaining({
        consumerTable: "review",
        rowLocator: { id: 42 },
        legacyBottleId: targetBottle.id,
        legacyReleaseId: otherRelease.id,
        targetId,
        legacyResolution: {
          status: "error",
          code: "CATALOG_TARGET_INVALID_MAPPING",
        },
      }),
    ]);
    expect(JSON.stringify(result.mismatches)).not.toContain("does not belong");
    expect(JSON.stringify(result.mismatches)).not.toContain("stack");
  });

  test("returns actionable filter-membership evidence", () => {
    const mismatches = recordCatalogTargetReadFilterParity(
      [
        {
          consumerTable: "tasting",
          rowLocator: { id: 61 },
          targetId: 101,
          legacy: { bottleId: 11, releaseId: null },
          filter: "entity",
          targetMatches: true,
          legacyMatches: false,
        },
        {
          consumerTable: "review",
          rowLocator: { id: 62 },
          targetId: null,
          legacy: { bottleId: null, releaseId: null },
          filter: "only_unknown",
          targetMatches: true,
          legacyMatches: true,
        },
      ],
      { caller: "catalogTargetReadParity.test", operation: "filter" },
    );

    expect(mismatches).toEqual([
      {
        consumerTable: "tasting",
        rowLocator: { id: 61 },
        legacyBottleId: 11,
        legacyReleaseId: null,
        targetId: 101,
        caller: "catalogTargetReadParity.test",
        operation: "filter",
        filter: "entity",
        targetMatches: true,
        legacyMatches: false,
      },
    ]);
    expect(JSON.stringify(mismatches)).not.toContain("stack");
  });

  test("never falls back from a missing or retired durable target", async ({
    fixtures,
  }) => {
    const targetBottle = await fixtures.Bottle();
    const legacyBottle = await fixtures.Bottle();
    const item = {
      consumerTable: "tasting" as const,
      rowLocator: { id: 51 },
      legacy: { bottleId: legacyBottle.id, releaseId: null },
    };

    await expect(
      loadCatalogTargetReadsWithParity(
        [{ ...item, targetId: 999_999 }],
        readContext,
      ),
    ).rejects.toMatchObject({
      code: "CATALOG_TARGET_NOT_FOUND",
      identity: { targetId: 999_999 },
    });

    const targetId = await exactTargetId(targetBottle.id);
    await db.insert(bottleTombstones).values({
      bottleId: targetBottle.id,
      newBottleId: null,
    });
    await expect(
      loadCatalogTargetReadsWithParity([{ ...item, targetId }], readContext),
    ).rejects.toMatchObject({
      code: "CATALOG_TARGET_RETIRED",
      identity: { bottleId: targetBottle.id },
      replacement: null,
    });
  });
});
