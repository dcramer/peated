import { db } from "@peated/server/db";
import { bottleAliases, reviews } from "@peated/server/db/schema";
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
