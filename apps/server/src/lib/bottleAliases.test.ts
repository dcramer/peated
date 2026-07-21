import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottleReleasePromotions,
  bottles,
  bottleTombstones,
  catalogTargets,
  reviews,
  storePrices,
} from "@peated/server/db/schema";
import { getUserActor } from "@peated/server/lib/actors";
import {
  assignBottleAliasInTransaction,
  ExactBottleAliasConflictError,
  finalizeBottleAliasAssignment,
  InvalidExactBottleAliasTargetError,
  reserveExactBottleAliasInTransaction,
} from "@peated/server/lib/bottleAliases";
import { CatalogTargetRetiredError } from "@peated/server/lib/catalogTargets";
import { mergeConcreteBottlesInTransaction } from "@peated/server/lib/mergeConcreteBottles";
import { normalizeBottleAliasKey } from "@peated/server/lib/normalize";
import waitError from "@peated/server/lib/test/waitError";
import * as workerClient from "@peated/server/worker/client";
import { and, eq, isNull, sql } from "drizzle-orm";
import { vi } from "vitest";

vi.mock("@peated/server/worker/client", () => ({
  pushJob: vi.fn(),
  pushUniqueJob: vi.fn(),
}));

const compatibilityContext = {
  caller: "bottleAliases.test",
  operation: "assignTargetlessAlias",
};

async function getExactTarget(bottleId: number) {
  const target = await db.query.catalogTargets.findFirst({
    where: eq(catalogTargets.bottleId, bottleId),
  });
  if (!target) throw new Error("Exact target fixture not found.");
  return target;
}

async function getGenericTarget(groupId: number) {
  const target = await db.query.catalogTargets.findFirst({
    where: and(
      eq(catalogTargets.groupId, groupId),
      isNull(catalogTargets.bottleId),
    ),
  });
  if (!target) throw new Error("Generic target fixture not found.");
  return target;
}

async function getAlias(name: string) {
  const alias = await db.query.bottleAliases.findFirst({
    where: eq(sql`LOWER(${bottleAliases.name})`, name.toLowerCase()),
  });
  if (!alias) throw new Error("Bottle alias fixture not found.");
  return alias;
}

describe("reserveExactBottleAliasInTransaction", () => {
  test("preserves an existing exact-target reservation", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const target = await getExactTarget(bottle.id);
    const originalActor = await getUserActor(
      await fixtures.User({ mod: true }),
    );
    const nextActor = await getUserActor(await fixtures.User({ mod: true }));
    const aliasName = normalizeBottleAliasKey("Reserved   12-year-old");
    await fixtures.BottleAlias({
      name: aliasName,
      bottleId: bottle.id,
      targetId: target.id,
      ignored: true,
      assignmentSource: "human_approved",
      assignedByActorId: originalActor.id,
    });

    const reservation = await db.transaction(async (tx) =>
      reserveExactBottleAliasInTransaction(tx, {
        name: "  Reserved 12 Year Old  ",
        bottleId: bottle.id,
        targetId: target.id,
        assignmentSource: "canonical",
        assignedByActorId: nextActor.id,
      }),
    );

    expect(reservation).toEqual({ changed: false, name: aliasName });
    expect(await getAlias(aliasName)).toMatchObject({
      name: aliasName,
      bottleId: bottle.id,
      releaseId: null,
      targetId: target.id,
      ignored: true,
      assignmentSource: "human_approved",
      assignedByActorId: originalActor.id,
    });
  });

  test("inserts or claims an unowned alias with canonical provenance", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const target = await getExactTarget(bottle.id);
    const actor = await getUserActor(await fixtures.User({ mod: true }));
    const inserted = await db.transaction(async (tx) =>
      reserveExactBottleAliasInTransaction(tx, {
        name: "New Exact Alias",
        bottleId: bottle.id,
        targetId: target.id,
        assignmentSource: "canonical",
        assignedByActorId: actor.id,
      }),
    );
    expect(inserted).toEqual({ changed: true, name: "New Exact Alias" });
    expect(await getAlias("New Exact Alias")).toMatchObject({
      bottleId: bottle.id,
      targetId: target.id,
      assignmentSource: "canonical",
      assignedByActorId: actor.id,
    });

    const aliasName = normalizeBottleAliasKey("Unowned   Alias");
    await db.insert(bottleAliases).values({
      name: aliasName,
      bottleId: null,
      releaseId: null,
      targetId: null,
      ignored: true,
      assignedByActorId: bottle.createdByActorId,
    });

    const claimed = await db.transaction(async (tx) =>
      reserveExactBottleAliasInTransaction(tx, {
        name: "  Unowned Alias ",
        bottleId: bottle.id,
        targetId: target.id,
        assignmentSource: "canonical",
        assignedByActorId: actor.id,
      }),
    );
    expect(claimed).toEqual({ changed: true, name: aliasName });
    expect(await getAlias(aliasName)).toMatchObject({
      name: aliasName,
      bottleId: bottle.id,
      releaseId: null,
      targetId: target.id,
      ignored: false,
      assignmentSource: "canonical",
      assignedByActorId: actor.id,
    });
  });

  test("upgrades a same-Bottle legacy alias to the exact target", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const target = await getExactTarget(bottle.id);
    const actor = await getUserActor(await fixtures.User({ mod: true }));
    const legacyAlias = await fixtures.BottleAlias({
      name: "Legacy Bottle Alias",
      bottleId: bottle.id,
      releaseId: null,
      targetId: null,
      ignored: true,
    });

    const alias = await db.transaction(async (tx) =>
      reserveExactBottleAliasInTransaction(tx, {
        name: legacyAlias.name,
        bottleId: bottle.id,
        targetId: target.id,
        assignmentSource: "human_approved",
        assignedByActorId: actor.id,
      }),
    );

    expect(alias).toEqual({ changed: true, name: legacyAlias.name });
    expect(await getAlias(legacyAlias.name)).toMatchObject({
      bottleId: bottle.id,
      releaseId: null,
      targetId: target.id,
      ignored: false,
      assignmentSource: "human_approved",
      assignedByActorId: actor.id,
    });
  });

  test("rejects an alias owned by another Bottle", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    const otherBottle = await fixtures.Bottle();
    const target = await getExactTarget(bottle.id);
    const alias = await fixtures.BottleAlias({
      name: "Other Bottle Alias",
      bottleId: otherBottle.id,
      targetId: null,
    });

    const error = await waitError(
      db.transaction(async (tx) =>
        reserveExactBottleAliasInTransaction(tx, {
          name: alias.name,
          bottleId: bottle.id,
          targetId: target.id,
          assignmentSource: "canonical",
          assignedByActorId: bottle.createdByActorId,
        }),
      ),
      ExactBottleAliasConflictError,
    );
    expect(error.code).toBe("another_bottle");
  });

  test("rejects an alias owned by another exact target", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const otherBottle = await fixtures.Bottle();
    const target = await getExactTarget(bottle.id);
    const otherTarget = await getExactTarget(otherBottle.id);
    const alias = await fixtures.BottleAlias({
      name: "Other Exact Target Alias",
      bottleId: bottle.id,
      targetId: otherTarget.id,
    });

    const error = await waitError(
      db.transaction(async (tx) =>
        reserveExactBottleAliasInTransaction(tx, {
          name: alias.name,
          bottleId: bottle.id,
          targetId: target.id,
          assignmentSource: "canonical",
          assignedByActorId: bottle.createdByActorId,
        }),
      ),
      ExactBottleAliasConflictError,
    );
    expect(error.code).toBe("another_exact_target");
  });

  test("rejects an alias owned by a generic target", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    const target = await getExactTarget(bottle.id);
    const genericTarget = await getGenericTarget(bottle.groupId!);
    const aliasName = "Generic Target Alias";
    await db.insert(bottleAliases).values({
      name: aliasName,
      bottleId: null,
      releaseId: null,
      targetId: genericTarget.id,
      assignedByActorId: bottle.createdByActorId,
    });

    const error = await waitError(
      db.transaction(async (tx) =>
        reserveExactBottleAliasInTransaction(tx, {
          name: aliasName,
          bottleId: bottle.id,
          targetId: target.id,
          assignmentSource: "canonical",
          assignedByActorId: bottle.createdByActorId,
        }),
      ),
      ExactBottleAliasConflictError,
    );
    expect(error.code).toBe("generic_target");
  });

  test("rejects an alias owned by a legacy release", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    const target = await getExactTarget(bottle.id);
    const release = await fixtures.BottleRelease({ bottleId: bottle.id });
    const alias = await fixtures.BottleAlias({
      name: "Legacy Release Alias",
      bottleId: bottle.id,
      releaseId: release.id,
      targetId: null,
    });

    const error = await waitError(
      db.transaction(async (tx) =>
        reserveExactBottleAliasInTransaction(tx, {
          name: alias.name,
          bottleId: bottle.id,
          targetId: target.id,
          assignmentSource: "canonical",
          assignedByActorId: bottle.createdByActorId,
        }),
      ),
      ExactBottleAliasConflictError,
    );
    expect(error.code).toBe("legacy_release");
  });
});

describe("assignBottleAliasInTransaction", () => {
  test("rejects a null consumer identity for an exact target before mutation", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const target = await getExactTarget(bottle.id);
    const name = "Invalid Null Exact Consumer";
    const price = await fixtures.StorePrice({
      name,
      bottleId: null,
      releaseId: null,
      targetId: null,
    });

    await expect(
      db.transaction(async (tx) =>
        assignBottleAliasInTransaction(tx, {
          target: {
            targetId: target.id,
            groupId: target.groupId,
            bottleId: bottle.id,
          },
          consumerIdentity: {
            bottleId: null,
            releaseId: null,
          },
          name,
          assignedByActorId: bottle.createdByActorId,
        }),
      ),
    ).rejects.toThrow(
      "Exact target alias assignment requires retained Bottle identity.",
    );

    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, name),
      }),
    ).toBeUndefined();
    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.id, price.id),
      }),
    ).toMatchObject({ bottleId: null, releaseId: null, targetId: null });
  });

  test("claims a matching legacy parent alias for a generic target without selecting a Bottle", async ({
    fixtures,
  }) => {
    const parent = await fixtures.Bottle();
    await fixtures.BottleRelease({ bottleId: parent.id });
    const target = await getGenericTarget(parent.groupId!);
    const alias = await fixtures.BottleAlias({
      name: "Stable Group Alias",
      bottleId: parent.id,
      releaseId: null,
      targetId: null,
    });
    const price = await fixtures.StorePrice({
      name: alias.name,
      bottleId: null,
      releaseId: null,
    });
    const review = await fixtures.Review({
      name: alias.name,
      bottleId: null,
      releaseId: null,
    });

    const result = await db.transaction(async (tx) =>
      assignBottleAliasInTransaction(tx, {
        target: {
          targetId: target.id,
          groupId: target.groupId,
          bottleId: null,
        },
        consumerIdentity: {
          bottleId: parent.id,
          releaseId: null,
        },
        name: alias.name,
        assignmentSource: "source_approved",
        assignedByActorId: parent.createdByActorId,
      }),
    );

    vi.mocked(workerClient.pushUniqueJob).mockClear();
    await finalizeBottleAliasAssignment(result);

    expect(await getAlias(alias.name)).toMatchObject({
      bottleId: null,
      releaseId: null,
      targetId: target.id,
    });
    expect(workerClient.pushUniqueJob).not.toHaveBeenCalledWith(
      "IndexBottleSearchVectors",
      expect.anything(),
    );
    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.id, price.id),
      }),
    ).toMatchObject({
      bottleId: parent.id,
      releaseId: null,
      targetId: target.id,
    });
    expect(
      await db.query.reviews.findFirst({
        where: eq(reviews.id, review.id),
      }),
    ).toMatchObject({
      bottleId: parent.id,
      releaseId: null,
      targetId: target.id,
    });
  });

  test("retains a promoted release pair while assigning its exact target", async ({
    fixtures,
  }) => {
    const parent = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: parent.id });
    const [promotedBottle] = await db
      .insert(bottles)
      .values({
        groupId: parent.groupId,
        brandId: parent.brandId,
        createdByActorId: parent.createdByActorId,
        name: "Promoted alias Bottle",
        fullName: "Promoted alias Bottle",
      })
      .returning();
    if (!promotedBottle) throw new Error("Unable to create promoted Bottle");
    const [target] = await db
      .insert(catalogTargets)
      .values({
        groupId: parent.groupId!,
        bottleId: promotedBottle.id,
      })
      .returning();
    if (!target) throw new Error("Unable to create promoted exact target");
    await db.insert(bottleReleasePromotions).values({
      releaseId: release.id,
      promotedBottleId: promotedBottle.id,
      status: "promoted",
      completedAt: new Date(),
      createdByActorId: parent.createdByActorId,
    });
    const name = "Promoted release consumer alias";
    const price = await fixtures.StorePrice({
      name,
      bottleId: null,
      releaseId: null,
      targetId: null,
    });
    const review = await fixtures.Review({
      name,
      bottleId: null,
      releaseId: null,
      targetId: null,
    });

    const result = await db.transaction(async (tx) =>
      assignBottleAliasInTransaction(tx, {
        target: {
          targetId: target.id,
          groupId: target.groupId,
          bottleId: promotedBottle.id,
        },
        consumerIdentity: {
          bottleId: parent.id,
          releaseId: release.id,
        },
        name,
        assignedByActorId: parent.createdByActorId,
      }),
    );

    vi.mocked(workerClient.pushUniqueJob).mockClear();
    await finalizeBottleAliasAssignment(result);

    expect(await getAlias(name)).toMatchObject({
      bottleId: promotedBottle.id,
      releaseId: null,
      targetId: target.id,
    });
    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.id, price.id),
      }),
    ).toMatchObject({
      bottleId: parent.id,
      releaseId: release.id,
      targetId: target.id,
    });
    expect(workerClient.pushUniqueJob).toHaveBeenCalledWith(
      "IndexBottleSearchVectors",
      { bottleId: promotedBottle.id },
    );
    expect(workerClient.pushUniqueJob).not.toHaveBeenCalledWith(
      "IndexBottleSearchVectors",
      { bottleId: parent.id },
    );
    expect(
      await db.query.reviews.findFirst({
        where: eq(reviews.id, review.id),
      }),
    ).toMatchObject({
      bottleId: parent.id,
      releaseId: release.id,
      targetId: target.id,
    });
  });

  test("validates the requested Bottle and exact target before assignment", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const target = await getExactTarget(bottle.id);

    const { alias } = await db.transaction(async (tx) =>
      assignBottleAliasInTransaction(tx, {
        bottleId: bottle.id,
        targetId: target.id,
        name: "Validated Exact Alias",
        assignmentSource: "human_approved",
        assignedByActorId: bottle.createdByActorId,
      }),
    );

    expect(alias).toMatchObject({
      bottleId: bottle.id,
      releaseId: null,
      targetId: target.id,
    });
  });

  test("claims an unbound exact alias through the shared assignment path", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const target = await getExactTarget(bottle.id);
    const assignedBy = await getUserActor(await fixtures.User({ mod: true }));
    const existing = await fixtures.BottleAlias({
      bottleId: null,
      releaseId: null,
      targetId: null,
      name: "Unbound Exact Assignment",
      ignored: true,
    });
    const review = await fixtures.Review({
      bottleId: null,
      releaseId: null,
      name: existing.name,
    });
    const price = await fixtures.StorePrice({
      bottleId: null,
      releaseId: null,
      name: existing.name,
    });

    const result = await db.transaction(async (tx) =>
      assignBottleAliasInTransaction(tx, {
        bottleId: bottle.id,
        targetId: target.id,
        name: existing.name,
        ignored: false,
        assignmentSource: "human_approved",
        assignedByActorId: assignedBy.id,
      }),
    );

    expect(result.isNew).toBe(false);
    expect(await getAlias(existing.name)).toMatchObject({
      bottleId: bottle.id,
      releaseId: null,
      targetId: target.id,
      ignored: false,
      assignmentSource: "human_approved",
      assignedByActorId: assignedBy.id,
    });
    expect(
      await db.query.reviews.findFirst({
        where: eq(reviews.id, review.id),
      }),
    ).toMatchObject({
      bottleId: bottle.id,
      releaseId: null,
      targetId: target.id,
    });
    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.id, price.id),
      }),
    ).toMatchObject({
      bottleId: bottle.id,
      releaseId: null,
      targetId: target.id,
    });
  });

  test("upgrades a same-Bottle targetless alias to the exact target", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const target = await getExactTarget(bottle.id);
    const existing = await fixtures.BottleAlias({
      bottleId: bottle.id,
      releaseId: null,
      targetId: null,
      name: "Targetless Alias",
    });

    await db.transaction(async (tx) =>
      assignBottleAliasInTransaction(tx, {
        bottleId: bottle.id,
        targetId: target.id,
        name: existing.name,
        assignmentSource: "human_approved",
        assignedByActorId: bottle.createdByActorId,
      }),
    );

    expect(await getAlias(existing.name)).toMatchObject({
      bottleId: bottle.id,
      releaseId: null,
      targetId: target.id,
    });
  });

  test("preserves an exact target when a legacy caller claims its unbound alias", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const target = await getExactTarget(bottle.id);
    const release = await fixtures.BottleRelease({ bottleId: bottle.id });
    const originalActor = await getUserActor(
      await fixtures.User({ mod: true }),
    );
    const legacyActor = await getUserActor(await fixtures.User({ mod: true }));
    const existing = await fixtures.BottleAlias({
      bottleId: null,
      releaseId: null,
      targetId: target.id,
      name: "Already Targeted Alias",
      ignored: true,
      assignmentSource: "human_approved",
      assignedByActorId: originalActor.id,
    });
    const independentlyMatchedBottle = await fixtures.Bottle();
    const independentlyMatchedTarget = await getExactTarget(
      independentlyMatchedBottle.id,
    );
    const review = await fixtures.Review({
      bottleId: independentlyMatchedBottle.id,
      releaseId: null,
      targetId: independentlyMatchedTarget.id,
      name: existing.name,
    });
    const price = await fixtures.StorePrice({
      bottleId: independentlyMatchedBottle.id,
      releaseId: null,
      targetId: independentlyMatchedTarget.id,
      name: existing.name,
    });

    await db.transaction(async (tx) =>
      assignBottleAliasInTransaction(tx, {
        bottleId: bottle.id,
        releaseId: release.id,
        name: existing.name,
        assignmentSource: "source_approved",
        assignedByActorId: legacyActor.id,
        context: compatibilityContext,
      }),
    );

    expect(await getAlias(existing.name)).toMatchObject({
      bottleId: bottle.id,
      releaseId: null,
      targetId: target.id,
      ignored: true,
      assignmentSource: "human_approved",
      assignedByActorId: originalActor.id,
    });
    expect(
      await db.query.reviews.findFirst({
        where: eq(reviews.id, review.id),
      }),
    ).toMatchObject({
      bottleId: independentlyMatchedBottle.id,
      releaseId: null,
      targetId: independentlyMatchedTarget.id,
    });
    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.id, price.id),
      }),
    ).toMatchObject({
      bottleId: independentlyMatchedBottle.id,
      releaseId: null,
      targetId: independentlyMatchedTarget.id,
    });
  });

  test("rejects targetless reuse of a generic alias without mutating durable state", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: bottle.id });
    const genericTarget = await getGenericTarget(bottle.groupId!);
    const originalActor = await getUserActor(
      await fixtures.User({ mod: true }),
    );
    const nextActor = await getUserActor(await fixtures.User({ mod: true }));
    const existing = await fixtures.BottleAlias({
      bottleId: null,
      releaseId: null,
      targetId: genericTarget.id,
      name: "Generic Compatibility Conflict",
      ignored: true,
      assignmentSource: "human_approved",
      assignedByActorId: originalActor.id,
    });
    const review = await fixtures.Review({
      bottleId: null,
      releaseId: null,
      name: existing.name,
    });
    const price = await fixtures.StorePrice({
      bottleId: null,
      releaseId: null,
      name: existing.name,
    });

    const error = await waitError(
      db.transaction(async (tx) =>
        assignBottleAliasInTransaction(tx, {
          bottleId: bottle.id,
          releaseId: release.id,
          name: existing.name,
          assignmentSource: "source_approved",
          assignedByActorId: nextActor.id,
          context: compatibilityContext,
        }),
      ),
      ExactBottleAliasConflictError,
    );

    expect(error.code).toBe("generic_target");
    expect(await getAlias(existing.name)).toMatchObject({
      bottleId: null,
      releaseId: null,
      targetId: genericTarget.id,
      ignored: true,
      assignmentSource: "human_approved",
      assignedByActorId: originalActor.id,
    });
    expect(
      await db.query.reviews.findFirst({
        where: eq(reviews.id, review.id),
      }),
    ).toMatchObject({ bottleId: null, releaseId: null });
    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.id, price.id),
      }),
    ).toMatchObject({ bottleId: null, releaseId: null });
  });

  test("validates that an explicit target is exact and owns the Bottle", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const otherBottle = await fixtures.Bottle();
    const otherTarget = await getExactTarget(otherBottle.id);
    const genericTarget = await getGenericTarget(bottle.groupId!);

    for (const [targetId, code] of [
      [genericTarget.id, "generic_target"],
      [otherTarget.id, "bottle_mismatch"],
    ] as const) {
      const name = `Invalid Target ${code}`;
      const error = await waitError(
        db.transaction(async (tx) =>
          assignBottleAliasInTransaction(tx, {
            bottleId: bottle.id,
            targetId,
            name,
            assignedByActorId: bottle.createdByActorId,
          }),
        ),
        InvalidExactBottleAliasTargetError,
      );

      expect(error.code).toBe(code);
      expect(
        await db.query.bottleAliases.findFirst({
          where: eq(bottleAliases.name, name),
        }),
      ).toBeUndefined();
    }
  });

  test("rejects a retired Bottle exact target without writing an alias", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const replacement = await fixtures.Bottle();
    const target = await getExactTarget(bottle.id);
    const name = "Retired Exact Target Alias";
    const review = await fixtures.Review({
      bottleId: null,
      releaseId: null,
      name,
    });
    const price = await fixtures.StorePrice({
      bottleId: null,
      releaseId: null,
      name,
    });
    await db.insert(bottleTombstones).values({
      bottleId: bottle.id,
      newBottleId: replacement.id,
    });

    const error = await waitError(
      db.transaction(async (tx) =>
        assignBottleAliasInTransaction(tx, {
          bottleId: bottle.id,
          targetId: target.id,
          name,
          assignedByActorId: bottle.createdByActorId,
        }),
      ),
      CatalogTargetRetiredError,
    );

    expect(error).toMatchObject({
      identity: { bottleId: bottle.id },
      replacement: { kind: "bottle", bottleId: replacement.id },
    });
    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, name),
      }),
    ).toBeUndefined();
    expect(
      await db.query.reviews.findFirst({
        where: eq(reviews.id, review.id),
      }),
    ).toMatchObject({ bottleId: null, releaseId: null });
    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.id, price.id),
      }),
    ).toMatchObject({ bottleId: null, releaseId: null });
  });

  test("rejects generic, different exact, and legacy-release ownership", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const target = await getExactTarget(bottle.id);
    const otherBottle = await fixtures.Bottle();
    const otherTarget = await getExactTarget(otherBottle.id);
    const genericTarget = await getGenericTarget(bottle.groupId!);
    const release = await fixtures.BottleRelease({ bottleId: bottle.id });
    const conflicts = [
      await fixtures.BottleAlias({
        name: "Generic Assignment Conflict",
        bottleId: null,
        releaseId: null,
        targetId: genericTarget.id,
      }),
      await fixtures.BottleAlias({
        name: "Exact Assignment Conflict",
        bottleId: otherBottle.id,
        releaseId: null,
        targetId: otherTarget.id,
      }),
      await fixtures.BottleAlias({
        name: "Release Assignment Conflict",
        bottleId: bottle.id,
        releaseId: release.id,
        targetId: null,
      }),
    ];

    for (const [index, existing] of conflicts.entries()) {
      const error = await waitError(
        db.transaction(async (tx) =>
          assignBottleAliasInTransaction(tx, {
            bottleId: bottle.id,
            targetId: target.id,
            name: existing.name,
            assignmentSource: "human_approved",
            assignedByActorId: bottle.createdByActorId,
          }),
        ),
        ExactBottleAliasConflictError,
      );

      expect(error.code).toBe(
        ["generic_target", "another_exact_target", "legacy_release"][index],
      );
      expect(await getAlias(existing.name)).toMatchObject({
        bottleId: existing.bottleId,
        releaseId: existing.releaseId,
        targetId: existing.targetId,
      });
    }
  });

  test("rolls back exact consumer backfills when the later alias claim conflicts", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const target = await getExactTarget(bottle.id);
    const otherBottle = await fixtures.Bottle();
    const otherTarget = await getExactTarget(otherBottle.id);
    const existing = await fixtures.BottleAlias({
      name: "Rollback Exact Conflict",
      bottleId: otherBottle.id,
      releaseId: null,
      targetId: otherTarget.id,
    });
    const review = await fixtures.Review({
      bottleId: null,
      releaseId: null,
      name: existing.name,
    });
    const price = await fixtures.StorePrice({
      bottleId: null,
      releaseId: null,
      name: existing.name,
    });

    const error = await waitError(
      db.transaction(async (tx) =>
        assignBottleAliasInTransaction(tx, {
          bottleId: bottle.id,
          targetId: target.id,
          name: existing.name,
          assignmentSource: "human_approved",
          assignedByActorId: bottle.createdByActorId,
        }),
      ),
      ExactBottleAliasConflictError,
    );

    expect(error.code).toBe("another_exact_target");
    expect(await getAlias(existing.name)).toMatchObject({
      bottleId: otherBottle.id,
      releaseId: null,
      targetId: otherTarget.id,
    });
    expect(
      await db.query.reviews.findFirst({
        where: eq(reviews.id, review.id),
      }),
    ).toMatchObject({ bottleId: null, releaseId: null });
    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.id, price.id),
      }),
    ).toMatchObject({ bottleId: null, releaseId: null });
  });

  test("does not downgrade an existing canonical release alias to bottle-only", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "Batch 1",
    });
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      releaseId: release.id,
      name: release.fullName,
    });

    await db.transaction(async (tx) => {
      await assignBottleAliasInTransaction(tx, {
        bottleId: bottle.id,
        releaseId: release.id,
        aliasReleaseId: null,
        name: release.fullName,
        assignedByActorId: bottle.createdByActorId,
        context: compatibilityContext,
      });
    });

    const alias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, release.fullName),
    });

    expect(alias).toMatchObject({
      bottleId: bottle.id,
      releaseId: release.id,
      name: release.fullName,
    });
  });

  test("updates matching reviews with the assigned release", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "Batch 1",
    });
    const review = await fixtures.Review({
      bottleId: null,
      releaseId: null,
      name: release.fullName,
    });

    await db.transaction(async (tx) => {
      await assignBottleAliasInTransaction(tx, {
        bottleId: bottle.id,
        releaseId: release.id,
        name: release.fullName,
        assignedByActorId: bottle.createdByActorId,
        context: compatibilityContext,
      });
    });

    const updatedReview = await db.query.reviews.findFirst({
      where: eq(reviews.id, review.id),
    });

    expect(updatedReview).toMatchObject({
      bottleId: bottle.id,
      releaseId: release.id,
    });
  });

  test("updates matching reviews with the accepted release when alias stays bottle-level", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "Batch 1",
    });
    const review = await fixtures.Review({
      bottleId: null,
      releaseId: null,
      name: release.fullName,
    });

    await db.transaction(async (tx) => {
      await assignBottleAliasInTransaction(tx, {
        bottleId: bottle.id,
        releaseId: release.id,
        aliasReleaseId: null,
        name: release.fullName,
        assignedByActorId: bottle.createdByActorId,
        context: compatibilityContext,
      });
    });

    const alias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, release.fullName),
    });
    const updatedReview = await db.query.reviews.findFirst({
      where: eq(reviews.id, review.id),
    });

    expect(alias).toMatchObject({
      bottleId: bottle.id,
      releaseId: null,
    });
    expect(updatedReview).toMatchObject({
      bottleId: bottle.id,
      releaseId: release.id,
    });
  });

  test("backfills stored reference names that differ from the alias name", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const storedName = `${bottle.fullName} 2011 Release`;
    const aliasName = `${storedName} Imported Label`;
    const price = await fixtures.StorePrice({
      bottleId: null,
      releaseId: null,
      name: storedName,
      volume: 750,
    });
    const review = await fixtures.Review({
      bottleId: null,
      releaseId: null,
      name: storedName,
      externalSiteId: price.externalSiteId,
    });

    await db.transaction(async (tx) => {
      await assignBottleAliasInTransaction(tx, {
        bottleId: bottle.id,
        name: aliasName,
        backfillNames: [storedName],
        externalSiteId: price.externalSiteId,
        volume: price.volume,
        assignedByActorId: bottle.createdByActorId,
        context: compatibilityContext,
      });
    });

    const updatedReview = await db.query.reviews.findFirst({
      where: eq(reviews.id, review.id),
    });
    const updatedPrice = await db.query.storePrices.findFirst({
      where: eq(storePrices.id, price.id),
    });
    const alias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, aliasName),
    });

    expect(alias).toMatchObject({
      bottleId: bottle.id,
      name: aliasName,
    });
    expect(updatedReview).toMatchObject({
      bottleId: bottle.id,
      releaseId: null,
    });
    expect(updatedPrice).toMatchObject({
      bottleId: bottle.id,
      releaseId: null,
    });
  });

  test("applies a matching price image only after assignment finalization", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ imageUrl: null });
    const imageUrl = "http://example.com/assignment-candidate.jpg";
    const price = await fixtures.StorePrice({
      bottleId: null,
      releaseId: null,
      name: "Price Image Candidate",
      imageUrl,
    });

    const result = await db.transaction(async (tx) =>
      assignBottleAliasInTransaction(tx, {
        bottleId: bottle.id,
        name: price.name,
        externalSiteId: price.externalSiteId,
        volume: price.volume,
        assignedByActorId: bottle.createdByActorId,
        context: compatibilityContext,
      }),
    );

    expect(result.bottleImageCandidate).toEqual({
      bottleId: bottle.id,
      imageUrl,
    });
    expect(
      await db.query.bottles.findFirst({
        where: eq(bottles.id, bottle.id),
      }),
    ).toMatchObject({ imageUrl: null });

    vi.mocked(workerClient.pushUniqueJob).mockClear();
    await finalizeBottleAliasAssignment(result);

    expect(
      await db.query.bottles.findFirst({
        where: eq(bottles.id, bottle.id),
      }),
    ).toMatchObject({ imageUrl });
    expect(workerClient.pushUniqueJob).not.toHaveBeenCalledWith(
      "IndexBottleSearchVectors",
      expect.anything(),
    );
  });

  test("indexes a new canonical assignment directly after commit", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const target = await getExactTarget(bottle.id);
    const result = await db.transaction(async (tx) =>
      assignBottleAliasInTransaction(tx, {
        bottleId: bottle.id,
        targetId: target.id,
        name: "Direct alias index failure",
        assignmentSource: "human_approved",
        assignedByActorId: bottle.createdByActorId,
      }),
    );
    expect(result.isNew).toBe(true);
    expect(await getAlias(result.alias.name)).toMatchObject({
      bottleId: bottle.id,
      targetId: target.id,
    });
    vi.mocked(workerClient.pushJob).mockClear();
    vi.mocked(workerClient.pushJob).mockRejectedValueOnce(
      new Error("Queue unavailable"),
    );

    await expect(
      finalizeBottleAliasAssignment(result),
    ).resolves.toBeUndefined();

    expect(workerClient.pushJob).toHaveBeenCalledWith("IndexBottleAlias", {
      name: result.alias.name,
    });
    expect(workerClient.pushJob).not.toHaveBeenCalledWith(
      "OnBottleAliasChange",
      expect.anything(),
    );
    expect(await getAlias(result.alias.name)).toMatchObject({
      bottleId: bottle.id,
      targetId: target.id,
    });
  });

  test("applies an image candidate to the merge replacement before finalization", async ({
    fixtures,
  }) => {
    const source = await fixtures.Bottle({
      name: "Image Merge Source",
      imageUrl: null,
    });
    const destination = await fixtures.Bottle({
      name: "Image Merge Destination",
      imageUrl: null,
    });
    const imageUrl = "http://example.com/merged-assignment-candidate.jpg";
    const price = await fixtures.StorePrice({
      bottleId: null,
      releaseId: null,
      name: "Merged Price Image Candidate",
      imageUrl,
    });
    const result = await db.transaction(async (tx) =>
      assignBottleAliasInTransaction(tx, {
        bottleId: source.id,
        name: price.name,
        externalSiteId: price.externalSiteId,
        volume: price.volume,
        assignedByActorId: source.createdByActorId,
        context: compatibilityContext,
      }),
    );

    await db.transaction(async (tx) =>
      mergeConcreteBottlesInTransaction(tx, {
        sourceBottleId: source.id,
        destinationBottleId: destination.id,
        actorId: source.createdByActorId,
      }),
    );
    await finalizeBottleAliasAssignment(result);

    expect(
      await db.query.bottles.findFirst({
        where: eq(bottles.id, destination.id),
      }),
    ).toMatchObject({ imageUrl });
  });

  test("scopes stored reference backfills by external site", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const storedName = `${bottle.fullName} 2011 Release`;
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const otherSite = await fixtures.ExternalSiteOrExisting({
      type: "astorwines",
    });
    const price = await fixtures.StorePrice({
      bottleId: null,
      releaseId: null,
      name: storedName,
      volume: 750,
      externalSiteId: site.id,
    });
    const matchingReview = await fixtures.Review({
      bottleId: null,
      releaseId: null,
      name: storedName,
      externalSiteId: site.id,
    });
    const otherSiteReview = await fixtures.Review({
      bottleId: null,
      releaseId: null,
      name: storedName,
      externalSiteId: otherSite.id,
    });

    await db.transaction(async (tx) => {
      await assignBottleAliasInTransaction(tx, {
        bottleId: bottle.id,
        name: storedName,
        externalSiteId: price.externalSiteId,
        volume: price.volume,
        assignedByActorId: bottle.createdByActorId,
        context: compatibilityContext,
      });
    });

    const updatedMatchingReview = await db.query.reviews.findFirst({
      where: eq(reviews.id, matchingReview.id),
    });
    const updatedOtherSiteReview = await db.query.reviews.findFirst({
      where: eq(reviews.id, otherSiteReview.id),
    });

    expect(updatedMatchingReview).toMatchObject({
      bottleId: bottle.id,
      releaseId: null,
    });
    expect(updatedOtherSiteReview).toMatchObject({
      bottleId: null,
      releaseId: null,
    });
  });

  test("rejects blank aliases without backfilling references", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const storedName = `${bottle.fullName} 2011 Release`;
    const review = await fixtures.Review({
      bottleId: null,
      releaseId: null,
      name: storedName,
    });
    const price = await fixtures.StorePrice({
      bottleId: null,
      releaseId: null,
      name: storedName,
      volume: 750,
    });

    await expect(
      db.transaction(async (tx) =>
        assignBottleAliasInTransaction(tx, {
          bottleId: bottle.id,
          name: "   ",
          assignedByActorId: bottle.createdByActorId,
          context: compatibilityContext,
        }),
      ),
    ).rejects.toThrow("Failed to save alias.");

    const updatedReview = await db.query.reviews.findFirst({
      where: eq(reviews.id, review.id),
    });
    const updatedPrice = await db.query.storePrices.findFirst({
      where: eq(storePrices.id, price.id),
    });
    const alias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, "   "),
    });

    expect(alias).toBeUndefined();
    expect(updatedReview).toMatchObject({
      bottleId: null,
      releaseId: null,
    });
    expect(updatedPrice).toMatchObject({
      bottleId: null,
      releaseId: null,
    });
  });

  test("stores assignment provenance when assigning an alias", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const assignedBy = await fixtures.User({ mod: true });
    const assignedByActor = await getUserActor(assignedBy);

    await db.transaction(async (tx) => {
      await assignBottleAliasInTransaction(tx, {
        bottleId: bottle.id,
        name: "Moderator Alias",
        assignmentSource: "human_approved",
        assignedByActorId: assignedByActor.id,
        context: compatibilityContext,
      });
    });

    const alias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, "Moderator Alias"),
    });

    expect(alias).toMatchObject({
      bottleId: bottle.id,
      assignmentSource: "human_approved",
      assignedByActorId: assignedByActor.id,
    });
  });

  test("preserves existing release matches when the alias stays release-owned", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "Batch 1",
    });
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      releaseId: release.id,
      name: release.fullName,
    });
    const review = await fixtures.Review({
      bottleId: bottle.id,
      releaseId: release.id,
      name: release.fullName,
    });

    await db.transaction(async (tx) => {
      await assignBottleAliasInTransaction(tx, {
        bottleId: bottle.id,
        releaseId: null,
        aliasReleaseId: null,
        name: release.fullName,
        assignedByActorId: bottle.createdByActorId,
        context: compatibilityContext,
      });
    });

    const updatedReview = await db.query.reviews.findFirst({
      where: eq(reviews.id, review.id),
    });

    expect(updatedReview).toMatchObject({
      bottleId: bottle.id,
      releaseId: release.id,
    });
  });
});
