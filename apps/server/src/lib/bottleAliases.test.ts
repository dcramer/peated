import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottleGroupTombstones,
  bottleReleasePromotions,
  bottleTombstones,
  catalogTargets,
  reviews,
  storePrices,
} from "@peated/server/db/schema";
import {
  assignBottleAliasInTransaction,
  BottleAliasBottleNotFoundError,
  BottleAliasBottleRetiredError,
  BottleAliasIdentityChangedError,
  finalizeBottleAliasAssignment,
  listUnmatchedBottleAliasNames,
  reserveExactBottleAliasInTransaction,
  reserveLegacyPromotionCanonicalAliasInTransaction,
  StaleBottleAliasReviewIdentityError,
  syncBottleAliasConsumersForAliasChange,
} from "@peated/server/lib/bottleAliases";
import { normalizeBottleAliasKey } from "@peated/server/lib/normalize";
import * as workerClient from "@peated/server/worker/client";
import { and, eq, isNull, sql } from "drizzle-orm";
import { beforeEach, vi } from "vitest";

vi.mock("@peated/server/worker/client", () => ({
  pushJob: vi.fn(),
  pushUniqueJob: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(workerClient.pushJob).mockReset();
  vi.mocked(workerClient.pushUniqueJob).mockReset();
});

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

describe("listUnmatchedBottleAliasNames", () => {
  test("uses nullable Bottle identity and ignores retained target evidence", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const target = await getExactTarget(bottle.id);
    await db.insert(bottleAliases).values([
      {
        name: "Unresolved With Target Evidence",
        bottleId: null,
        targetId: target.id,
        assignedByActorId: bottle.createdByActorId,
      },
      {
        name: "Resolved Without Target Evidence",
        bottleId: bottle.id,
        targetId: null,
        assignedByActorId: bottle.createdByActorId,
      },
      {
        name: "Ignored Unresolved Alias",
        bottleId: null,
        ignored: true,
        assignedByActorId: bottle.createdByActorId,
      },
    ]);

    await expect(
      listUnmatchedBottleAliasNames({ limit: 100, offset: 0 }),
    ).resolves.toEqual(["Unresolved With Target Evidence"]);
  });
});

describe("exact Bottle alias reservation", () => {
  test("normalizes the name and preserves legacy evidence columns", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: bottle.id });
    const target = await getExactTarget(bottle.id);
    const original = await fixtures.BottleAlias({
      name: normalizeBottleAliasKey("Reserved   12-year-old"),
      bottleId: bottle.id,
      releaseId: release.id,
      targetId: target.id,
      assignmentSource: "legacy",
    });

    const result = await db.transaction((tx) =>
      reserveExactBottleAliasInTransaction(tx, {
        name: "Reserved   12-year-old",
        bottleId: bottle.id,
        assignmentSource: "canonical",
        assignedByActorId: bottle.createdByActorId,
      }),
    );

    expect(result).toEqual({ name: original.name, changed: true });
    expect(await getAlias(original.name)).toMatchObject({
      bottleId: bottle.id,
      releaseId: release.id,
      targetId: target.id,
      assignmentSource: "canonical",
    });
  });

  test("rejects a name already assigned to another Bottle", async ({
    fixtures,
  }) => {
    const existingBottle = await fixtures.Bottle();
    const selectedBottle = await fixtures.Bottle();
    const alias = await fixtures.BottleAlias({
      name: "Bottle Identity Collision",
      bottleId: existingBottle.id,
    });

    await expect(
      db.transaction((tx) =>
        reserveExactBottleAliasInTransaction(tx, {
          name: alias.name,
          bottleId: selectedBottle.id,
          assignmentSource: "canonical",
          assignedByActorId: selectedBottle.createdByActorId,
        }),
      ),
    ).rejects.toMatchObject({
      name: "ExactBottleAliasConflictError",
      code: "another_bottle",
      conflictingBottleId: existingBottle.id,
    });
  });

  test("rejects every inactive Bottle state", async ({ fixtures }) => {
    const retired = await fixtures.Bottle();
    const replacement = await fixtures.Bottle();
    const unassigned = await fixtures.LegacyBottle();
    const retiredGroupMember = await fixtures.Bottle();
    const groupReplacement = await fixtures.Bottle();
    await db.insert(bottleTombstones).values({
      bottleId: retired.id,
      newBottleId: replacement.id,
    });
    await db.insert(bottleGroupTombstones).values({
      groupId: retiredGroupMember.groupId!,
      newGroupId: groupReplacement.groupId!,
      createdByActorId: retiredGroupMember.createdByActorId,
    });

    await expect(
      db.transaction((tx) =>
        reserveExactBottleAliasInTransaction(tx, {
          name: "Retired Bottle Alias",
          bottleId: retired.id,
          assignmentSource: "canonical",
          assignedByActorId: retired.createdByActorId,
        }),
      ),
    ).rejects.toBeInstanceOf(BottleAliasBottleRetiredError);

    await expect(
      db.transaction((tx) =>
        reserveExactBottleAliasInTransaction(tx, {
          name: "Unassigned Bottle Alias",
          bottleId: unassigned.id,
          assignmentSource: "canonical",
          assignedByActorId: unassigned.createdByActorId,
        }),
      ),
    ).rejects.toMatchObject({
      name: "BottleAliasBottleInactiveError",
      reason: "unassigned",
      message: `Bottle ${unassigned.id} is not assigned to a BottleGroup.`,
    });

    await expect(
      db.transaction((tx) =>
        reserveExactBottleAliasInTransaction(tx, {
          name: "Retired Group Bottle Alias",
          bottleId: retiredGroupMember.id,
          assignmentSource: "canonical",
          assignedByActorId: retiredGroupMember.createdByActorId,
        }),
      ),
    ).rejects.toMatchObject({
      name: "BottleAliasBottleInactiveError",
      reason: "group_retired",
      message: `Bottle ${retiredGroupMember.id} belongs to a retired BottleGroup.`,
    });

    await expect(
      db.transaction((tx) =>
        reserveExactBottleAliasInTransaction(tx, {
          name: "Missing Bottle Alias",
          bottleId: 2_147_483_647,
          assignmentSource: "canonical",
          assignedByActorId: retired.createdByActorId,
        }),
      ),
    ).rejects.toBeInstanceOf(BottleAliasBottleNotFoundError);

    await expect(
      db
        .select({ name: bottleAliases.name })
        .from(bottleAliases)
        .where(
          sql`${bottleAliases.name} IN ('Retired Bottle Alias', 'Unassigned Bottle Alias', 'Retired Group Bottle Alias', 'Missing Bottle Alias')`,
        ),
    ).resolves.toEqual([]);
  });
});

describe("assignBottleAliasInTransaction", () => {
  test("writes one Bottle id while retaining legacy evidence", async ({
    fixtures,
  }) => {
    const selected = await fixtures.Bottle();
    const legacy = await fixtures.Bottle();
    const alreadyAssigned = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: legacy.id });
    const target = await getGenericTarget(legacy.groupId!);
    const name = "Shared Retailer Bottle Name";
    await db.insert(bottleAliases).values({
      name,
      bottleId: null,
      releaseId: release.id,
      targetId: target.id,
      assignedByActorId: legacy.createdByActorId,
    });
    const price = await fixtures.StorePrice({
      name,
      bottleId: null,
      releaseId: release.id,
      targetId: target.id,
      volume: 750,
    });
    const review = await fixtures.Review({
      name,
      bottleId: null,
      releaseId: release.id,
      targetId: target.id,
    });
    const assignedPrice = await fixtures.StorePrice({
      name,
      bottleId: alreadyAssigned.id,
      volume: 700,
    });
    const assignedReview = await fixtures.Review({
      name,
      bottleId: alreadyAssigned.id,
      issue: "Second issue",
    });

    const result = await db.transaction((tx) =>
      assignBottleAliasInTransaction(tx, {
        bottleId: selected.id,
        name,
        assignmentSource: "human_approved",
        assignedByActorId: selected.createdByActorId,
      }),
    );

    expect(result).toMatchObject({
      bottleId: selected.id,
      aliasChanged: true,
      isNew: false,
    });
    expect(await getAlias(name)).toMatchObject({
      bottleId: selected.id,
      releaseId: release.id,
      targetId: target.id,
      assignmentSource: "human_approved",
    });
    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.id, price.id),
      }),
    ).toMatchObject({
      bottleId: selected.id,
      releaseId: price.releaseId,
      targetId: price.targetId,
    });
    expect(
      await db.query.reviews.findFirst({ where: eq(reviews.id, review.id) }),
    ).toMatchObject({
      bottleId: selected.id,
      releaseId: review.releaseId,
      targetId: review.targetId,
    });
    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.id, assignedPrice.id),
      }),
    ).toMatchObject({ bottleId: alreadyAssigned.id });
    expect(
      await db.query.reviews.findFirst({
        where: eq(reviews.id, assignedReview.id),
      }),
    ).toMatchObject({ bottleId: alreadyAssigned.id });
  });

  test("retargets only an explicitly snapshotted Review", async ({
    fixtures,
  }) => {
    const previous = await fixtures.Bottle();
    const selected = await fixtures.Bottle();
    const name = "Reviewed Direct Assignment";
    const selectedReview = await fixtures.Review({
      name,
      bottleId: previous.id,
    });
    const otherReview = await fixtures.Review({
      name,
      bottleId: previous.id,
      issue: "Other issue",
    });

    await db.transaction((tx) =>
      assignBottleAliasInTransaction(tx, {
        bottleId: selected.id,
        name,
        assignedByActorId: selected.createdByActorId,
        expectedReview: selectedReview,
      }),
    );

    expect(
      await db.query.reviews.findFirst({
        where: eq(reviews.id, selectedReview.id),
      }),
    ).toMatchObject({ bottleId: selected.id });
    expect(
      await db.query.reviews.findFirst({
        where: eq(reviews.id, otherReview.id),
      }),
    ).toMatchObject({ bottleId: previous.id });
  });

  test("rolls back when the expected Review identity is stale", async ({
    fixtures,
  }) => {
    const previous = await fixtures.Bottle();
    const concurrent = await fixtures.Bottle();
    const selected = await fixtures.Bottle();
    const review = await fixtures.Review({
      name: "Concurrent Review Alias",
      bottleId: previous.id,
    });
    await db
      .update(reviews)
      .set({ bottleId: concurrent.id })
      .where(eq(reviews.id, review.id));

    await expect(
      db.transaction((tx) =>
        assignBottleAliasInTransaction(tx, {
          bottleId: selected.id,
          name: review.name,
          assignedByActorId: selected.createdByActorId,
          expectedReview: review,
        }),
      ),
    ).rejects.toBeInstanceOf(StaleBottleAliasReviewIdentityError);
    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, review.name),
      }),
    ).toBeUndefined();
  });

  test("rolls back when a source alias snapshot changes", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const source = await fixtures.BottleAlias({
      name: "Raw Source Alias",
      bottleId: null,
    });
    await db
      .update(bottleAliases)
      .set({ ignored: !source.ignored })
      .where(eq(bottleAliases.name, source.name));

    await expect(
      db.transaction((tx) =>
        assignBottleAliasInTransaction(tx, {
          bottleId: bottle.id,
          name: "Normalized Source Alias",
          assignedByActorId: bottle.createdByActorId,
          sourceAliasIdentity: source,
        }),
      ),
    ).rejects.toBeInstanceOf(BottleAliasIdentityChangedError);
    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, "Normalized Source Alias"),
      }),
    ).toBeUndefined();
  });

  test("release promotion evidence cannot authorize an alias retarget", async ({
    fixtures,
  }) => {
    const parent = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: parent.id });
    const promoted = await fixtures.Bottle();
    await db.insert(bottleReleasePromotions).values({
      releaseId: release.id,
      promotedBottleId: promoted.id,
      status: "promoted",
      completedAt: new Date(),
      createdByActorId: parent.createdByActorId,
    });
    const alias = await fixtures.BottleAlias({
      name: "Promotion Evidence Alias",
      bottleId: parent.id,
      releaseId: release.id,
    });

    await expect(
      db.transaction((tx) =>
        assignBottleAliasInTransaction(tx, {
          bottleId: promoted.id,
          name: alias.name,
          assignedByActorId: promoted.createdByActorId,
          sourceAliasIdentity: alias,
        }),
      ),
    ).rejects.toMatchObject({
      name: "ExactBottleAliasConflictError",
      code: "another_bottle",
      conflictingBottleId: parent.id,
    });
    expect(await getAlias(alias.name)).toMatchObject({
      bottleId: parent.id,
      releaseId: release.id,
      targetId: alias.targetId,
    });
  });

  test("scopes propagation by site and volume", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const otherSite = await fixtures.ExternalSiteOrExisting({
      type: "astorwines",
    });
    const name = "Scoped Retailer Alias";
    const matchingPrice = await fixtures.StorePrice({
      name,
      bottleId: null,
      externalSiteId: site.id,
      volume: 750,
    });
    const otherVolume = await fixtures.StorePrice({
      name,
      bottleId: null,
      externalSiteId: site.id,
      volume: 700,
    });
    const matchingReview = await fixtures.Review({
      name,
      bottleId: null,
      externalSiteId: site.id,
    });
    const otherReview = await fixtures.Review({
      name,
      bottleId: null,
      externalSiteId: otherSite.id,
    });

    await db.transaction((tx) =>
      assignBottleAliasInTransaction(tx, {
        bottleId: bottle.id,
        name,
        externalSiteId: site.id,
        volume: 750,
        assignedByActorId: bottle.createdByActorId,
      }),
    );

    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.id, matchingPrice.id),
      }),
    ).toMatchObject({ bottleId: bottle.id });
    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.id, otherVolume.id),
      }),
    ).toMatchObject({ bottleId: null });
    expect(
      await db.query.reviews.findFirst({
        where: eq(reviews.id, matchingReview.id),
      }),
    ).toMatchObject({ bottleId: bottle.id });
    expect(
      await db.query.reviews.findFirst({
        where: eq(reviews.id, otherReview.id),
      }),
    ).toMatchObject({ bottleId: null });
  });

  test("rejects blank aliases without mutating matching consumers", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const price = await fixtures.StorePrice({ name: "   ", bottleId: null });

    await expect(
      db.transaction((tx) =>
        assignBottleAliasInTransaction(tx, {
          bottleId: bottle.id,
          name: "   ",
          assignedByActorId: bottle.createdByActorId,
        }),
      ),
    ).rejects.toMatchObject({ name: "FailedToSaveBottleAliasError" });
    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.id, price.id),
      }),
    ).toMatchObject({ bottleId: null });
  });
});

describe("migration and replay compatibility", () => {
  test("promotion changes runtime Bottle identity and retains target evidence", async ({
    fixtures,
  }) => {
    const legacy = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: legacy.id });
    const promoted = await fixtures.Bottle();
    const target = await getExactTarget(promoted.id);
    await db
      .update(bottleAliases)
      .set({
        bottleId: legacy.id,
        releaseId: release.id,
        targetId: null,
      })
      .where(eq(bottleAliases.name, release.fullName));

    await db.transaction((tx) =>
      reserveLegacyPromotionCanonicalAliasInTransaction(tx, {
        name: release.fullName,
        promotedBottleId: promoted.id,
        targetId: target.id,
        legacyBottleId: legacy.id,
        legacyReleaseId: release.id,
        assignedByActorId: promoted.createdByActorId,
      }),
    );

    expect(await getAlias(release.fullName)).toMatchObject({
      bottleId: promoted.id,
      releaseId: null,
      targetId: target.id,
      assignmentSource: "canonical",
    });
  });

  test("raw alias replay uses Bottle identity without target resolution", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const target = await getGenericTarget(bottle.groupId!);
    const alias = await fixtures.BottleAlias({
      name: "Replay Direct Bottle Alias",
      bottleId: bottle.id,
      targetId: target.id,
    });
    const price = await fixtures.StorePrice({
      name: alias.name,
      bottleId: null,
    });

    await syncBottleAliasConsumersForAliasChange(alias.name);

    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.id, price.id),
      }),
    ).toMatchObject({ bottleId: bottle.id });
  });
});

describe("finalizeBottleAliasAssignment", () => {
  test("applies a price image and indexes the direct Bottle", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ imageUrl: null });
    const imageUrl = "https://example.com/direct-bottle.jpg";
    const price = await fixtures.StorePrice({
      bottleId: null,
      name: "Direct Bottle Image",
      imageUrl,
    });
    const result = await db.transaction((tx) =>
      assignBottleAliasInTransaction(tx, {
        bottleId: bottle.id,
        name: price.name,
        externalSiteId: price.externalSiteId,
        volume: price.volume,
        assignedByActorId: bottle.createdByActorId,
      }),
    );

    await finalizeBottleAliasAssignment(result);

    expect(
      await db.query.bottles.findFirst({
        where: (bottles, { eq }) => eq(bottles.id, bottle.id),
      }),
    ).toMatchObject({ imageUrl });
    expect(workerClient.pushJob).toHaveBeenCalledWith("IndexBottleAlias", {
      name: result.alias.name,
    });
    expect(workerClient.pushUniqueJob).toHaveBeenCalledWith(
      "IndexBottleSearchVectors",
      { bottleId: bottle.id },
    );
  });

  test("treats queue failures as nonfatal post-commit effects", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const result = await db.transaction((tx) =>
      assignBottleAliasInTransaction(tx, {
        bottleId: bottle.id,
        name: "Queue Failure Alias",
        assignedByActorId: bottle.createdByActorId,
      }),
    );
    vi.mocked(workerClient.pushJob).mockRejectedValueOnce(
      new Error("Queue unavailable"),
    );
    vi.mocked(workerClient.pushUniqueJob).mockRejectedValueOnce(
      new Error("Queue unavailable"),
    );

    await expect(
      finalizeBottleAliasAssignment(result),
    ).resolves.toBeUndefined();
    expect(await getAlias(result.alias.name)).toMatchObject({
      bottleId: bottle.id,
    });
  });
});
