import { db } from "@peated/server/db";
import {
  bottleGroups,
  bottleReleasePromotions,
  bottles,
  catalogTargets,
  collectionBottles,
  collections,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { and, eq, isNull } from "drizzle-orm";
import { describe, expect, test } from "vitest";

async function getExactTargetId(bottleId: number): Promise<number> {
  const target = await db.query.catalogTargets.findFirst({
    where: eq(catalogTargets.bottleId, bottleId),
  });
  if (!target) throw new Error("Missing exact target fixture");
  return target.id;
}

async function getGenericTargetId(groupId: number): Promise<number> {
  const target = await db.query.catalogTargets.findFirst({
    where: and(
      eq(catalogTargets.groupId, groupId),
      isNull(catalogTargets.bottleId),
    ),
  });
  if (!target) throw new Error("Missing generic target fixture");
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
  if (!bottle) throw new Error("Unable to create Bottle fixture");
  const [target] = await db
    .insert(catalogTargets)
    .values({ groupId, bottleId: bottle.id })
    .returning();
  if (!target) throw new Error("Unable to create exact target fixture");
  await db
    .update(bottleGroups)
    .set({ totalBottles: 2 })
    .where(eq(bottleGroups.id, groupId));
  return { bottle, target };
}

describe("DELETE /users/:user/collections/:collection/bottles", () => {
  test("requires auth", async () => {
    const err = await waitError(() =>
      routerClient.collections.bottles.delete({
        user: "me",
        collection: "default",
        bottle: 1,
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("deletes an exact target membership by base-only intent", async ({
    fixtures,
    defaults,
  }) => {
    const bottle = await fixtures.Bottle();
    const targetId = await getExactTargetId(bottle.id);
    const collection = await fixtures.Collection({
      createdById: defaults.user.id,
      totalBottles: 1,
    });
    const [membership] = await db
      .insert(collectionBottles)
      .values({
        bottleId: bottle.id,
        collectionId: collection.id,
        targetId,
      })
      .returning();

    await routerClient.collections.bottles.delete(
      {
        user: "me",
        collection: collection.id,
        bottle: bottle.id,
        baseOnly: true,
      },
      { context: { user: defaults.user } },
    );

    expect(
      await db.query.collectionBottles.findFirst({
        where: eq(collectionBottles.id, membership!.id),
      }),
    ).toBeUndefined();
    expect(
      await db.query.collections.findFirst({
        where: eq(collections.id, collection.id),
      }),
    ).toMatchObject({ totalBottles: 0 });
  });

  test("deletes a generic target membership by base-only intent", async ({
    fixtures,
    defaults,
  }) => {
    const parent = await fixtures.Bottle();
    await fixtures.BottleRelease({ bottleId: parent.id });
    const targetId = await getGenericTargetId(parent.groupId as number);
    const collection = await fixtures.Collection({
      createdById: defaults.user.id,
      totalBottles: 1,
    });
    const [membership] = await db
      .insert(collectionBottles)
      .values({
        bottleId: parent.id,
        collectionId: collection.id,
        targetId,
      })
      .returning();

    await routerClient.collections.bottles.delete(
      {
        user: "me",
        collection: collection.id,
        bottle: parent.id,
        baseOnly: true,
      },
      { context: { user: defaults.user } },
    );

    expect(
      await db.query.collectionBottles.findFirst({
        where: eq(collectionBottles.id, membership!.id),
      }),
    ).toBeUndefined();
    expect(
      await db.query.collections.findFirst({
        where: eq(collections.id, collection.id),
      }),
    ).toMatchObject({ totalBottles: 0 });
  });

  test("deletes a promoted release membership by its exact target", async ({
    fixtures,
    defaults,
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
      promotedBottleId: promoted.bottle.id,
      status: "promoted",
      completedAt: new Date(),
      createdByActorId: parent.createdByActorId,
    });
    const collection = await fixtures.Collection({
      createdById: defaults.user.id,
      totalBottles: 1,
    });
    const [membership] = await db
      .insert(collectionBottles)
      .values({
        bottleId: parent.id,
        releaseId: release.id,
        collectionId: collection.id,
        targetId: promoted.target.id,
      })
      .returning();

    await routerClient.collections.bottles.delete(
      {
        user: "me",
        collection: collection.id,
        bottle: parent.id,
        release: release.id,
      },
      { context: { user: defaults.user } },
    );

    expect(
      await db.query.collectionBottles.findFirst({
        where: eq(collectionBottles.id, membership!.id),
      }),
    ).toBeUndefined();
    expect(
      await db.query.collections.findFirst({
        where: eq(collections.id, collection.id),
      }),
    ).toMatchObject({ totalBottles: 0 });
  });

  test("uses target identity despite pair drift and preserves a different durable target", async ({
    fixtures,
    defaults,
  }) => {
    const selectedBottle = await fixtures.Bottle();
    const selectedTargetId = await getExactTargetId(selectedBottle.id);
    const driftBottle = await fixtures.Bottle();
    const otherBottle = await fixtures.Bottle();
    const otherTargetId = await getExactTargetId(otherBottle.id);
    const collection = await fixtures.Collection({
      createdById: defaults.user.id,
      totalBottles: 2,
    });
    const [selectedMembership, otherMembership] = await db
      .insert(collectionBottles)
      .values([
        {
          bottleId: driftBottle.id,
          collectionId: collection.id,
          targetId: selectedTargetId,
        },
        {
          bottleId: selectedBottle.id,
          collectionId: collection.id,
          targetId: otherTargetId,
        },
      ])
      .returning();

    await routerClient.collections.bottles.delete(
      {
        user: "me",
        collection: collection.id,
        bottle: selectedBottle.id,
        baseOnly: true,
      },
      { context: { user: defaults.user } },
    );

    expect(
      await db.query.collectionBottles.findFirst({
        where: eq(collectionBottles.id, selectedMembership!.id),
      }),
    ).toBeUndefined();
    expect(
      await db.query.collectionBottles.findFirst({
        where: eq(collectionBottles.id, otherMembership!.id),
      }),
    ).toMatchObject({
      bottleId: selectedBottle.id,
      targetId: otherTargetId,
    });
    expect(
      await db.query.collections.findFirst({
        where: eq(collections.id, collection.id),
      }),
    ).toMatchObject({ totalBottles: 1 });
  });

  test("deletes the authoritative target and its targetless retained-pair duplicate", async ({
    fixtures,
    defaults,
  }) => {
    const selectedBottle = await fixtures.Bottle();
    const driftBottle = await fixtures.Bottle();
    const selectedTargetId = await getExactTargetId(selectedBottle.id);
    const collection = await fixtures.Collection({
      createdById: defaults.user.id,
      totalBottles: 2,
    });
    await db.insert(collectionBottles).values([
      {
        bottleId: driftBottle.id,
        collectionId: collection.id,
        targetId: selectedTargetId,
      },
      {
        bottleId: selectedBottle.id,
        collectionId: collection.id,
        targetId: null,
      },
    ]);

    await routerClient.collections.bottles.delete(
      {
        user: "me",
        collection: collection.id,
        bottle: selectedBottle.id,
        baseOnly: true,
      },
      { context: { user: defaults.user } },
    );

    expect(
      await db.query.collectionBottles.findMany({
        where: eq(collectionBottles.collectionId, collection.id),
      }),
    ).toHaveLength(0);
    expect(
      await db.query.collections.findFirst({
        where: eq(collections.id, collection.id),
      }),
    ).toMatchObject({ totalBottles: 0 });
  });

  test("delete bottle from default", async ({ fixtures, defaults }) => {
    const bottle = await fixtures.Bottle();
    const collection = await fixtures.Collection({
      createdById: defaults.user.id,
      totalBottles: 1,
    });
    await db.insert(collectionBottles).values({
      bottleId: bottle.id,
      collectionId: collection.id,
    });

    await routerClient.collections.bottles.delete(
      {
        user: "me",
        collection: collection.id,
        bottle: bottle.id,
      },
      { context: { user: defaults.user } },
    );

    const bottleList = await db
      .select()
      .from(collectionBottles)
      .where(eq(collectionBottles.bottleId, bottle.id));

    expect(bottleList.length).toBe(0);

    // Verify totalBottles was decremented
    const [updatedCollection] = await db
      .select()
      .from(collections)
      .where(eq(collections.id, collection.id));
    expect(updatedCollection.totalBottles).toBe(0);
  });

  test("delete bottle from library", async ({ fixtures, defaults }) => {
    const bottle = await fixtures.Bottle();
    const collection = await fixtures.Collection({
      name: "Library",
      createdById: defaults.user.id,
      totalBottles: 1,
    });
    await db.insert(collectionBottles).values({
      bottleId: bottle.id,
      collectionId: collection.id,
    });

    await routerClient.collections.bottles.delete(
      {
        user: "me",
        collection: "library",
        bottle: bottle.id,
      },
      { context: { user: defaults.user } },
    );

    const bottleList = await db
      .select()
      .from(collectionBottles)
      .where(eq(collectionBottles.bottleId, bottle.id));

    expect(bottleList).toHaveLength(0);

    const [updatedCollection] = await db
      .select()
      .from(collections)
      .where(eq(collections.id, collection.id));
    expect(updatedCollection.totalBottles).toBe(0);
  });

  test("deletes a staged targetless release membership", async ({
    fixtures,
    defaults,
  }) => {
    const bottle = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: bottle.id });
    const collection = await fixtures.Collection({
      createdById: defaults.user.id,
      totalBottles: 1,
    });
    const [membership] = await db
      .insert(collectionBottles)
      .values({
        bottleId: bottle.id,
        collectionId: collection.id,
        releaseId: release.id,
      })
      .returning();
    expect(membership).toMatchObject({ targetId: null });

    await routerClient.collections.bottles.delete(
      {
        user: "me",
        collection: collection.id,
        bottle: bottle.id,
        release: release.id,
      },
      { context: { user: defaults.user } },
    );

    const bottleList = await db
      .select()
      .from(collectionBottles)
      .where(
        and(
          eq(collectionBottles.bottleId, bottle.id),
          eq(collectionBottles.releaseId, release.id),
        ),
      );

    expect(bottleList.length).toBe(0);

    // Verify totalBottles was decremented
    const [updatedCollection] = await db
      .select()
      .from(collections)
      .where(eq(collections.id, collection.id));
    expect(updatedCollection.totalBottles).toBe(0);
  });

  test("deletes a staged targetless ungrouped parent membership", async ({
    fixtures,
    defaults,
  }) => {
    const bottle = await fixtures.LegacyBottle();
    const collection = await fixtures.Collection({
      createdById: defaults.user.id,
      totalBottles: 1,
    });
    const [membership] = await db
      .insert(collectionBottles)
      .values({
        bottleId: bottle.id,
        collectionId: collection.id,
      })
      .returning();

    await routerClient.collections.bottles.delete(
      {
        user: "me",
        collection: collection.id,
        bottle: bottle.id,
        baseOnly: true,
      },
      { context: { user: defaults.user } },
    );

    expect(
      await db.query.collectionBottles.findFirst({
        where: eq(collectionBottles.id, membership!.id),
      }),
    ).toBeUndefined();
    expect(
      await db.query.collections.findFirst({
        where: eq(collections.id, collection.id),
      }),
    ).toMatchObject({ totalBottles: 0 });
  });

  test("only deletes specific release", async ({ fixtures, defaults }) => {
    const bottle = await fixtures.Bottle();
    const release1 = await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "A",
    });
    const release2 = await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "B",
    });
    const collection = await fixtures.Collection({
      name: "default",
      createdById: defaults.user.id,
      totalBottles: 2,
    });

    // Add both releases to collection
    await db.insert(collectionBottles).values({
      bottleId: bottle.id,
      collectionId: collection.id,
      releaseId: release1.id,
    });
    await db.insert(collectionBottles).values({
      bottleId: bottle.id,
      collectionId: collection.id,
      releaseId: release2.id,
    });

    await routerClient.collections.bottles.delete(
      {
        user: "me",
        collection: "default",
        bottle: bottle.id,
        release: release1.id,
      },
      { context: { user: defaults.user } },
    );

    // Should only delete release1, leaving release2
    const bottleList = await db
      .select()
      .from(collectionBottles)
      .where(eq(collectionBottles.bottleId, bottle.id));

    expect(bottleList.length).toBe(1);
    expect(bottleList[0].releaseId).toBe(release2.id);

    // Verify totalBottles was decremented by 1 even though we still have one release
    const [updatedCollection] = await db
      .select()
      .from(collections)
      .where(eq(collections.id, collection.id));
    expect(updatedCollection.totalBottles).toBe(1);
  });

  test("preserves legacy family deletion across target-aware retained rows", async ({
    fixtures,
    defaults,
  }) => {
    const bottle = await fixtures.Bottle();
    const release1 = await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "A",
    });
    const release2 = await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "B",
    });
    const collection = await fixtures.Collection({
      name: "default",
      createdById: defaults.user.id,
      totalBottles: 2,
    });
    const firstTargetBottle = await fixtures.Bottle();
    const secondTargetBottle = await fixtures.Bottle();

    await db.insert(collectionBottles).values([
      {
        bottleId: bottle.id,
        collectionId: collection.id,
        releaseId: release1.id,
        targetId: await getExactTargetId(firstTargetBottle.id),
      },
      {
        bottleId: bottle.id,
        collectionId: collection.id,
        releaseId: release2.id,
        targetId: await getExactTargetId(secondTargetBottle.id),
      },
    ]);

    await routerClient.collections.bottles.delete(
      {
        user: "me",
        collection: "default",
        bottle: bottle.id,
        release: null,
      },
      { context: { user: defaults.user } },
    );

    const bottleList = await db
      .select()
      .from(collectionBottles)
      .where(eq(collectionBottles.bottleId, bottle.id));

    expect(bottleList).toHaveLength(0);

    const [updatedCollection] = await db
      .select()
      .from(collections)
      .where(eq(collections.id, collection.id));
    expect(updatedCollection.totalBottles).toBe(0);
  });

  test("deletes only the base bottle entry when baseOnly is specified", async ({
    fixtures,
    defaults,
  }) => {
    const bottle = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "Store Pick",
    });
    const collection = await fixtures.Collection({
      name: "default",
      createdById: defaults.user.id,
      totalBottles: 2,
    });

    await db.insert(collectionBottles).values([
      {
        bottleId: bottle.id,
        collectionId: collection.id,
        releaseId: null,
      },
      {
        bottleId: bottle.id,
        collectionId: collection.id,
        releaseId: release.id,
      },
    ]);

    await routerClient.collections.bottles.delete(
      {
        user: "me",
        collection: "default",
        bottle: bottle.id,
        baseOnly: true,
      },
      { context: { user: defaults.user } },
    );

    const bottleList = await db
      .select()
      .from(collectionBottles)
      .where(eq(collectionBottles.bottleId, bottle.id));

    expect(bottleList).toHaveLength(1);
    expect(bottleList[0].releaseId).toBe(release.id);

    const [updatedCollection] = await db
      .select()
      .from(collections)
      .where(eq(collections.id, collection.id));
    expect(updatedCollection.totalBottles).toBe(1);
  });

  test("deleting non-existent bottle from collection", async ({
    fixtures,
    defaults,
  }) => {
    const bottle = await fixtures.Bottle();
    const collection = await fixtures.Collection({
      createdById: defaults.user.id,
      totalBottles: 1,
    });

    await routerClient.collections.bottles.delete(
      {
        user: "me",
        collection: collection.id,
        bottle: bottle.id,
      },
      { context: { user: defaults.user } },
    );

    // Verify totalBottles hasn't changed
    const [updatedCollection] = await db
      .select()
      .from(collections)
      .where(eq(collections.id, collection.id));
    expect(updatedCollection.totalBottles).toBe(1);

    // Verify no bottles were deleted (though there weren't any to begin with)
    const bottleList = await db
      .select()
      .from(collectionBottles)
      .where(eq(collectionBottles.bottleId, bottle.id));
    expect(bottleList.length).toBe(0);
  });

  test("deleting from missing library is a no-op", async ({
    fixtures,
    defaults,
  }) => {
    const bottle = await fixtures.Bottle();

    await routerClient.collections.bottles.delete(
      {
        user: "me",
        collection: "library",
        bottle: bottle.id,
      },
      { context: { user: defaults.user } },
    );

    const libraryCollection = await db.query.collections.findFirst({
      where: (collections, { and, eq }) =>
        and(
          eq(collections.createdById, defaults.user.id),
          eq(collections.name, "Library"),
        ),
    });

    expect(libraryCollection).toBeUndefined();
  });

  test("prevents deleting from another user's library", async ({
    fixtures,
    defaults,
  }) => {
    const bottle = await fixtures.Bottle();
    const otherUser = await fixtures.User();

    const err = await waitError(() =>
      routerClient.collections.bottles.delete(
        {
          user: otherUser.id,
          collection: "library",
          bottle: bottle.id,
        },
        { context: { user: defaults.user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(
      `[Error: Cannot modify another user's collection.]`,
    );
  });
});
