import { db } from "@peated/server/db";
import {
  bottleAliases,
  catalogTargets,
  reviews,
  storePrices,
} from "@peated/server/db/schema";
import { getUserActor } from "@peated/server/lib/actors";
import {
  assignBottleAliasInTransaction,
  ExactBottleAliasConflictError,
  reserveExactBottleAliasInTransaction,
} from "@peated/server/lib/bottleAliases";
import { normalizeBottleAliasKey } from "@peated/server/lib/normalize";
import waitError from "@peated/server/lib/test/waitError";
import { and, eq, isNull, sql } from "drizzle-orm";

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
