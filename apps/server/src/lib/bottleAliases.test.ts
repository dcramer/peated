import { db } from "@peated/server/db";
import { bottleAliases, reviews, storePrices } from "@peated/server/db/schema";
import { assignBottleAliasInTransaction } from "@peated/server/lib/bottleAliases";
import { eq } from "drizzle-orm";

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

  test("backfills stored reference names that differ from the alias name", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const storedName = `${bottle.fullName} 2011 Release`;
    const aliasName = `${storedName} Imported Label`;
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

    await db.transaction(async (tx) => {
      await assignBottleAliasInTransaction(tx, {
        bottleId: bottle.id,
        name: aliasName,
        backfillNames: [storedName],
        externalSiteId: price.externalSiteId,
        volume: price.volume,
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

  test("stores assignment provenance when assigning an alias", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const assignedBy = await fixtures.User({ mod: true });

    await db.transaction(async (tx) => {
      await assignBottleAliasInTransaction(tx, {
        bottleId: bottle.id,
        name: "Moderator Alias",
        assignmentSource: "human_approved",
        assignedById: assignedBy.id,
      });
    });

    const alias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, "Moderator Alias"),
    });

    expect(alias).toMatchObject({
      bottleId: bottle.id,
      assignmentSource: "human_approved",
      assignedById: assignedBy.id,
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
