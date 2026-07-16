import { db } from "@peated/server/db";
import {
  bottles,
  catalogTargets,
  collectionBottles,
  collections,
  reviews,
  tastings,
} from "@peated/server/db/schema";
import {
  CatalogTargetConsumerConflictError,
  CatalogTargetConsumerConsolidationInputError,
  consolidateCatalogTargetConsumersInTransaction,
} from "@peated/server/lib/consolidateCatalogTargetConsumers";
import waitError from "@peated/server/lib/test/waitError";
import { asc, eq, inArray } from "drizzle-orm";
import { describe, expect, test } from "vitest";

async function exactTargetId(bottleId: number) {
  const [target] = await db
    .select({ id: catalogTargets.id })
    .from(catalogTargets)
    .where(eq(catalogTargets.bottleId, bottleId));
  if (!target) throw new Error(`Missing exact target for Bottle ${bottleId}.`);
  return target.id;
}

describe("catalog target consumer consolidation", () => {
  test("composes with exact-target consumer migration without changing either Bottle", async ({
    fixtures,
  }) => {
    const sourceBottle = await fixtures.Bottle();
    const destinationBottle = await fixtures.Bottle();
    const sourceTargetId = await exactTargetId(sourceBottle.id);
    const destinationTargetId = await exactTargetId(destinationBottle.id);
    const review = await fixtures.Review({
      bottleId: sourceBottle.id,
      targetId: sourceTargetId,
    });
    const collection = await fixtures.Collection({ totalBottles: 2 });
    const [sourceCollectionRow, destinationCollectionRow] = await db
      .insert(collectionBottles)
      .values([
        {
          collectionId: collection.id,
          bottleId: sourceBottle.id,
          targetId: sourceTargetId,
          imageUrl: "/source.jpg",
          status: "sealed",
        },
        {
          collectionId: collection.id,
          bottleId: destinationBottle.id,
          targetId: destinationTargetId,
          imageUrl: null,
          status: "open",
        },
      ])
      .returning();
    const bottlesBefore = await db
      .select()
      .from(bottles)
      .where(inArray(bottles.id, [sourceBottle.id, destinationBottle.id]))
      .orderBy(asc(bottles.id));

    const preimages = await db.transaction(async (tx) => {
      const result = await consolidateCatalogTargetConsumersInTransaction(tx, {
        sourceTargetId,
        destinationTargetId,
      });
      await tx
        .update(reviews)
        .set({ bottleId: destinationBottle.id })
        .where(eq(reviews.id, review.id));
      return result;
    });

    expect(
      await db.select().from(reviews).where(eq(reviews.id, review.id)),
    ).toEqual([
      expect.objectContaining({
        id: review.id,
        bottleId: destinationBottle.id,
        targetId: destinationTargetId,
      }),
    ]);
    expect(
      await db
        .select()
        .from(collectionBottles)
        .where(eq(collectionBottles.collectionId, collection.id)),
    ).toEqual([
      expect.objectContaining({
        id: destinationCollectionRow.id,
        bottleId: destinationBottle.id,
        targetId: destinationTargetId,
        imageUrl: "/source.jpg",
        status: "open",
      }),
    ]);
    expect(
      await db
        .select({ totalBottles: collections.totalBottles })
        .from(collections)
        .where(eq(collections.id, collection.id)),
    ).toEqual([{ totalBottles: 1 }]);
    expect(preimages.directTargets.reviews).toEqual([
      { id: review.id, targetId: sourceTargetId },
    ]);
    expect(preimages.collections.sourceRows).toEqual([sourceCollectionRow]);
    expect(preimages.collections.destinationRowsBefore).toEqual([
      destinationCollectionRow,
    ]);
    expect(
      await db
        .select()
        .from(bottles)
        .where(inArray(bottles.id, [sourceBottle.id, destinationBottle.id]))
        .orderBy(asc(bottles.id)),
    ).toEqual(bottlesBefore);
  });

  test("rejects a tasting collision with a full transaction rollback", async ({
    fixtures,
  }) => {
    const sourceBottle = await fixtures.Bottle();
    const destinationBottle = await fixtures.Bottle();
    const sourceTargetId = await exactTargetId(sourceBottle.id);
    const destinationTargetId = await exactTargetId(destinationBottle.id);
    const user = await fixtures.User();
    const createdAt = new Date("2026-07-01T02:03:04.000Z");
    const sourceTasting = await fixtures.Tasting({
      bottleId: sourceBottle.id,
      targetId: sourceTargetId,
      createdById: user.id,
      createdAt,
    });
    const destinationTasting = await fixtures.Tasting({
      bottleId: destinationBottle.id,
      targetId: destinationTargetId,
      createdById: user.id,
      createdAt,
    });
    const collection = await fixtures.Collection({ totalBottles: 2 });
    const [sourceCollectionRow, destinationCollectionRow] = await db
      .insert(collectionBottles)
      .values([
        {
          collectionId: collection.id,
          bottleId: sourceBottle.id,
          targetId: sourceTargetId,
          imageUrl: "/source.jpg",
          status: "sealed",
        },
        {
          collectionId: collection.id,
          bottleId: destinationBottle.id,
          targetId: destinationTargetId,
          imageUrl: null,
          status: "open",
        },
      ])
      .returning();

    const error = await waitError(
      db.transaction((tx) =>
        consolidateCatalogTargetConsumersInTransaction(tx, {
          sourceTargetId,
          destinationTargetId,
        }),
      ),
      CatalogTargetConsumerConflictError,
    );

    expect(error).toBeInstanceOf(CatalogTargetConsumerConflictError);
    expect(
      await db
        .select()
        .from(collectionBottles)
        .where(eq(collectionBottles.collectionId, collection.id))
        .orderBy(asc(collectionBottles.id)),
    ).toEqual(
      [sourceCollectionRow, destinationCollectionRow].sort(
        (left, right) => left.id - right.id,
      ),
    );
    expect(
      await db
        .select({ totalBottles: collections.totalBottles })
        .from(collections)
        .where(eq(collections.id, collection.id)),
    ).toEqual([{ totalBottles: 2 }]);
    expect(
      await db
        .select({ id: tastings.id, targetId: tastings.targetId })
        .from(tastings)
        .where(inArray(tastings.id, [sourceTasting.id, destinationTasting.id]))
        .orderBy(asc(tastings.id)),
    ).toEqual(
      [
        { id: sourceTasting.id, targetId: sourceTargetId },
        { id: destinationTasting.id, targetId: destinationTargetId },
      ].sort((left, right) => left.id - right.id),
    );
  });

  test("rejects identical source and destination targets before mutation", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const targetId = await exactTargetId(bottle.id);

    const error = await waitError(
      db.transaction((tx) =>
        consolidateCatalogTargetConsumersInTransaction(tx, {
          sourceTargetId: targetId,
          destinationTargetId: targetId,
        }),
      ),
      CatalogTargetConsumerConsolidationInputError,
    );

    expect(error).toBeInstanceOf(CatalogTargetConsumerConsolidationInputError);
  });
});
