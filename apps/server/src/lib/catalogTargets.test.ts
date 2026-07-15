import { db } from "@peated/server/db";
import {
  bottleGroupTombstones,
  bottleGroups,
  bottleReleasePromotions,
  bottleTombstones,
  bottles,
  catalogTargets,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { eq } from "drizzle-orm";
import {
  CatalogTargetIntegrityMismatchError,
  CatalogTargetInvalidMappingError,
  CatalogTargetNotFoundError,
  CatalogTargetRetiredError,
  loadCatalogTarget,
  loadCatalogTargetByBottleId,
  loadCatalogTargetByGroupId,
  loadCatalogTargetByLegacyReference,
  resolveCatalogTargetIdForAssignment,
} from "./catalogTargets";

const readContext = {
  actor: null,
  permissions: { canReadCatalogIdentity: true },
} as const;

const legacyReadContext = {
  ...readContext,
  caller: "catalogTargets.test",
  operation: "load-legacy-reference",
} as const;

const assignmentContext = {
  caller: "catalogTargets.test",
  operation: "assign-target",
} as const;

async function getGenericTargetId(groupId: number): Promise<number> {
  const target = await db.query.catalogTargets.findFirst({
    where: (catalogTargets, { and, eq, isNull }) =>
      and(eq(catalogTargets.groupId, groupId), isNull(catalogTargets.bottleId)),
  });
  if (!target) throw new Error("Missing generic target fixture");
  return target.id;
}

async function getExactTargetId(bottleId: number): Promise<number> {
  const target = await db.query.catalogTargets.findFirst({
    where: eq(catalogTargets.bottleId, bottleId),
  });
  if (!target) throw new Error("Missing exact target fixture");
  return target.id;
}

async function createBottleInGroup({
  groupId,
  brandId,
  createdByActorId,
  name,
}: {
  groupId: number;
  brandId: number;
  createdByActorId: number;
  name: string;
}) {
  const [bottle] = await db
    .insert(bottles)
    .values({
      groupId,
      brandId,
      createdByActorId,
      name,
      fullName: name,
    })
    .returning();
  if (!bottle) throw new Error("Unable to create promoted Bottle fixture");
  await db.insert(catalogTargets).values({ groupId, bottleId: bottle.id });
  await db
    .update(bottleGroups)
    .set({ totalBottles: 2 })
    .where(eq(bottleGroups.id, groupId));
  return bottle;
}

describe("catalog target loading", () => {
  test("loads an exact Bottle target through the runtime-owned schema", async ({
    fixtures,
  }) => {
    const distiller = await fixtures.Entity();
    const bottle = await fixtures.Bottle({
      distillerIds: [distiller.id],
      edition: "Batch 7",
      releaseYear: 2026,
      abv: 55.4,
    });

    const target = await loadCatalogTargetByBottleId(bottle.id, readContext);

    expect(target).toMatchObject({
      schemaVersion: 1,
      kind: "bottle",
      group: {
        id: bottle.groupId,
        distillerIds: [distiller.id],
        totalBottles: 1,
      },
      bottle: {
        id: bottle.id,
        groupId: bottle.groupId,
        edition: "Batch 7",
        releaseYear: 2026,
        abv: 55.4,
      },
    });
    expect(target.group.createdAt).toMatch(/Z$/);
  });

  test("loads a generic target without substituting its representative Bottle", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    await db
      .update(bottleGroups)
      .set({ representativeBottleId: bottle.id })
      .where(eq(bottleGroups.id, bottle.groupId as number));

    const target = await loadCatalogTargetByGroupId(
      bottle.groupId as number,
      readContext,
    );

    expect(target).toMatchObject({
      kind: "group",
      group: {
        id: bottle.groupId,
        representativeBottleId: bottle.id,
      },
    });
    expect(target).not.toHaveProperty("bottle");
  });

  test("loads a target by durable target id", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    const targetId = await getExactTargetId(bottle.id);

    await expect(
      loadCatalogTarget(targetId, readContext),
    ).resolves.toMatchObject({ kind: "bottle", targetId });
  });

  test("returns distinct missing and retired target errors", async ({
    fixtures,
  }) => {
    await expect(
      loadCatalogTarget(999_999, readContext),
    ).rejects.toBeInstanceOf(CatalogTargetNotFoundError);

    const retired = await fixtures.Bottle();
    const replacement = await fixtures.Bottle();
    await db.insert(bottleGroupTombstones).values({
      groupId: retired.groupId as number,
      newGroupId: replacement.groupId as number,
      createdByActorId: retired.createdByActorId,
    });

    await expect(
      loadCatalogTargetByGroupId(retired.groupId as number, readContext),
    ).rejects.toMatchObject({
      code: "CATALOG_TARGET_RETIRED",
      replacement: {
        kind: "group",
        groupId: replacement.groupId,
      },
    });
  });

  test("returns the exact Bottle replacement for a retired Bottle", async ({
    fixtures,
  }) => {
    const retired = await fixtures.Bottle();
    const replacement = await fixtures.Bottle();
    await db.insert(bottleTombstones).values({
      bottleId: retired.id,
      newBottleId: replacement.id,
    });

    const error = await waitError<CatalogTargetRetiredError>(
      loadCatalogTargetByBottleId(retired.id, readContext),
    );

    expect(error).toBeInstanceOf(CatalogTargetRetiredError);
    expect(error).toMatchObject({
      code: "CATALOG_TARGET_RETIRED",
      identity: { bottleId: retired.id },
      replacement: { kind: "bottle", bottleId: replacement.id },
    });

    const deleted = await fixtures.Bottle();
    await db.insert(bottleTombstones).values({
      bottleId: deleted.id,
      newBottleId: null,
    });

    const deletedError = await waitError<CatalogTargetRetiredError>(
      loadCatalogTargetByBottleId(deleted.id, readContext),
    );
    expect(deletedError.replacement).toBeNull();
  });
});

describe("legacy catalog target resolution", () => {
  test("resolves a promoted release to its exact Bottle target", async ({
    fixtures,
  }) => {
    const parent = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: parent.id });
    const promoted = await createBottleInGroup({
      groupId: parent.groupId as number,
      brandId: parent.brandId,
      createdByActorId: parent.createdByActorId,
      name: `${parent.fullName} promoted`,
    });
    await db.insert(bottleReleasePromotions).values({
      releaseId: release.id,
      promotedBottleId: promoted.id,
      status: "promoted",
      completedAt: new Date(),
      createdByActorId: parent.createdByActorId,
    });
    const target = await loadCatalogTargetByLegacyReference(
      { bottleId: parent.id, releaseId: release.id },
      legacyReadContext,
    );

    expect(target).toMatchObject({
      kind: "bottle",
      targetId: await getExactTargetId(promoted.id),
      bottle: { id: promoted.id, groupId: parent.groupId },
    });
  });

  test("uses parent cardinality for generic and retained exact references", async ({
    fixtures,
  }) => {
    const parentWithRelease = await fixtures.Bottle();
    await fixtures.BottleRelease({ bottleId: parentWithRelease.id });
    const retained = await fixtures.Bottle();

    const generic = await loadCatalogTargetByLegacyReference(
      { bottleId: parentWithRelease.id, releaseId: null },
      legacyReadContext,
    );
    const exact = await loadCatalogTargetByLegacyReference(
      { bottleId: retained.id, releaseId: null },
      legacyReadContext,
    );

    expect(generic).toMatchObject({
      kind: "group",
      targetId: await getGenericTargetId(parentWithRelease.groupId as number),
    });
    expect(exact).toMatchObject({
      kind: "bottle",
      targetId: await getExactTargetId(retained.id),
      bottle: { id: retained.id },
    });
  });

  test("rejects a release paired with the wrong parent as an invalid mapping", async ({
    fixtures,
  }) => {
    const parent = await fixtures.Bottle();
    const otherParent = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: parent.id });

    await expect(
      loadCatalogTargetByLegacyReference(
        { bottleId: otherParent.id, releaseId: release.id },
        legacyReadContext,
      ),
    ).rejects.toBeInstanceOf(CatalogTargetInvalidMappingError);
  });

  test("rejects a valid legacy pair without a completed promotion mapping", async ({
    fixtures,
  }) => {
    const parent = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: parent.id });

    const error = await waitError<CatalogTargetInvalidMappingError>(
      loadCatalogTargetByLegacyReference(
        { bottleId: parent.id, releaseId: release.id },
        legacyReadContext,
      ),
    );

    expect(error).toBeInstanceOf(CatalogTargetInvalidMappingError);
    expect(error).toMatchObject({
      code: "CATALOG_TARGET_INVALID_MAPPING",
      bottleId: parent.id,
      releaseId: release.id,
    });
  });

  test("rejects a promotion mapped into a different group as an integrity mismatch", async ({
    fixtures,
  }) => {
    const parent = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: parent.id });
    const wrongGroupBottle = await fixtures.Bottle();
    await db.insert(bottleReleasePromotions).values({
      releaseId: release.id,
      promotedBottleId: wrongGroupBottle.id,
      status: "promoted",
      completedAt: new Date(),
      createdByActorId: parent.createdByActorId,
    });

    await expect(
      loadCatalogTargetByLegacyReference(
        { bottleId: parent.id, releaseId: release.id },
        legacyReadContext,
      ),
    ).rejects.toBeInstanceOf(CatalogTargetIntegrityMismatchError);
  });
});

describe("catalog target assignment", () => {
  test("deterministically resolves exact, generic, durable, and legacy writes", async ({
    fixtures,
  }) => {
    const parent = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: parent.id });
    const promoted = await createBottleInGroup({
      groupId: parent.groupId as number,
      brandId: parent.brandId,
      createdByActorId: parent.createdByActorId,
      name: `${parent.fullName} assignment`,
    });
    await db.insert(bottleReleasePromotions).values({
      releaseId: release.id,
      promotedBottleId: promoted.id,
      status: "promoted",
      completedAt: new Date(),
      createdByActorId: parent.createdByActorId,
    });
    const exactTargetId = await getExactTargetId(promoted.id);
    const genericTargetId = await getGenericTargetId(parent.groupId as number);
    await expect(
      resolveCatalogTargetIdForAssignment({
        kind: "bottle",
        bottleId: promoted.id,
      }),
    ).resolves.toBe(exactTargetId);
    await expect(
      resolveCatalogTargetIdForAssignment({
        kind: "group",
        groupId: parent.groupId as number,
      }),
    ).resolves.toBe(genericTargetId);
    await expect(
      resolveCatalogTargetIdForAssignment({
        kind: "target",
        targetId: exactTargetId,
      }),
    ).resolves.toBe(exactTargetId);
    await expect(
      resolveCatalogTargetIdForAssignment({
        kind: "legacy",
        bottleId: parent.id,
        releaseId: release.id,
        context: assignmentContext,
      }),
    ).resolves.toBe(exactTargetId);
  });

  test("requires operation and caller context for legacy assignment", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();

    await expect(
      resolveCatalogTargetIdForAssignment({
        kind: "legacy",
        bottleId: bottle.id,
        releaseId: null,
        context: { caller: "", operation: "create" },
      }),
    ).rejects.toThrow(/requires caller and operation/);
  });
});
