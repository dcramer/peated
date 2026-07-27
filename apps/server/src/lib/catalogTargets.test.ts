import { db } from "@peated/server/db";
import {
  bottleGroups,
  bottleReleasePromotions,
  bottles,
  catalogTargets,
} from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import {
  CatalogTargetIntegrityMismatchError,
  lockCatalogTargetAssignmentDescriptorsInTransaction,
  lockCatalogTargetConsumerAssignmentInTransaction,
  resolveCatalogTargetForAssignment,
} from "./catalogTargets";

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

describe("catalog target assignment", () => {
  test("accepts a promoted legacy pair retained on its exact Bottle target", async ({
    fixtures,
  }) => {
    const parent = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: parent.id });
    const promoted = await createBottleInGroup({
      groupId: parent.groupId as number,
      brandId: parent.brandId,
      createdByActorId: parent.createdByActorId,
      name: `${parent.fullName} retained assignment`,
    });
    await db.insert(bottleReleasePromotions).values({
      releaseId: release.id,
      promotedBottleId: promoted.id,
      status: "promoted",
      completedAt: new Date(),
      createdByActorId: parent.createdByActorId,
    });
    const target = await resolveCatalogTargetForAssignment({
      kind: "bottle",
      bottleId: promoted.id,
    });

    await expect(
      db.transaction((tx) =>
        lockCatalogTargetConsumerAssignmentInTransaction(
          tx,
          {
            target,
            consumerIdentity: {
              bottleId: parent.id,
              releaseId: release.id,
            },
          },
          assignmentContext,
        ),
      ),
    ).resolves.toBeUndefined();
  });

  test("rejects a promoted legacy pair retained on a different exact target", async ({
    fixtures,
  }) => {
    const parent = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: parent.id });
    const promoted = await createBottleInGroup({
      groupId: parent.groupId as number,
      brandId: parent.brandId,
      createdByActorId: parent.createdByActorId,
      name: `${parent.fullName} promoted assignment`,
    });
    const differentBottle = await fixtures.Bottle();
    await db.insert(bottleReleasePromotions).values({
      releaseId: release.id,
      promotedBottleId: promoted.id,
      status: "promoted",
      completedAt: new Date(),
      createdByActorId: parent.createdByActorId,
    });
    const differentTarget = await resolveCatalogTargetForAssignment({
      kind: "bottle",
      bottleId: differentBottle.id,
    });

    await expect(
      db.transaction((tx) =>
        lockCatalogTargetConsumerAssignmentInTransaction(
          tx,
          {
            target: differentTarget,
            consumerIdentity: {
              bottleId: parent.id,
              releaseId: release.id,
            },
          },
          assignmentContext,
        ),
      ),
    ).rejects.toMatchObject({
      code: "CATALOG_TARGET_INTEGRITY_MISMATCH",
      reason: "the retained Bottle pair does not resolve to its target",
    });
  });

  test("batch locks and revalidates every supplied descriptor", async ({
    fixtures,
  }) => {
    const exactBottle = await fixtures.Bottle();
    const genericBottle = await fixtures.Bottle();
    await fixtures.BottleRelease({ bottleId: genericBottle.id });
    const exactTarget = await resolveCatalogTargetForAssignment({
      kind: "bottle",
      bottleId: exactBottle.id,
    });
    const genericTarget = await resolveCatalogTargetForAssignment({
      kind: "group",
      groupId: genericBottle.groupId as number,
    });

    await expect(
      db.transaction(async (tx) => {
        await lockCatalogTargetAssignmentDescriptorsInTransaction(tx, [
          genericTarget,
          exactTarget,
          exactTarget,
        ]);
      }),
    ).resolves.toBeUndefined();

    await expect(
      db.transaction(async (tx) => {
        await lockCatalogTargetAssignmentDescriptorsInTransaction(tx, [
          exactTarget,
          { ...genericTarget, groupId: exactTarget.groupId },
        ]);
      }),
    ).rejects.toBeInstanceOf(CatalogTargetIntegrityMismatchError);
  });

  test("resolves validated descriptors for target, Bottle, group, and legacy writes", async ({
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
      resolveCatalogTargetForAssignment({
        kind: "bottle",
        bottleId: promoted.id,
      }),
    ).resolves.toEqual({
      targetId: exactTargetId,
      groupId: parent.groupId,
      bottleId: promoted.id,
    });
    await expect(
      resolveCatalogTargetForAssignment({
        kind: "group",
        groupId: parent.groupId as number,
      }),
    ).resolves.toEqual({
      targetId: genericTargetId,
      groupId: parent.groupId,
      bottleId: null,
    });
    await expect(
      resolveCatalogTargetForAssignment({
        kind: "target",
        targetId: exactTargetId,
      }),
    ).resolves.toEqual({
      targetId: exactTargetId,
      groupId: parent.groupId,
      bottleId: promoted.id,
    });
    await expect(
      resolveCatalogTargetForAssignment({
        kind: "legacy",
        bottleId: parent.id,
        releaseId: release.id,
        context: assignmentContext,
      }),
    ).resolves.toEqual({
      targetId: exactTargetId,
      groupId: parent.groupId,
      bottleId: promoted.id,
    });
  });

  test("requires operation and caller context for legacy assignment", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();

    await expect(
      resolveCatalogTargetForAssignment({
        kind: "legacy",
        bottleId: bottle.id,
        releaseId: null,
        context: { caller: "", operation: "create" },
      }),
    ).rejects.toThrow(/requires caller and operation/);
  });
});
