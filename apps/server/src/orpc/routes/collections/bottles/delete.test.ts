import { db } from "@peated/server/db";
import { collectionBottles, collections } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { and, eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

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

  test("delete bottle with release", async ({ fixtures, defaults }) => {
    const bottle = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: bottle.id });
    const collection = await fixtures.Collection({
      createdById: defaults.user.id,
      totalBottles: 1,
    });
    await db.insert(collectionBottles).values({
      bottleId: bottle.id,
      collectionId: collection.id,
      releaseId: release.id,
    });

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
      totalBottles: 1,
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
    expect(updatedCollection.totalBottles).toBe(0);
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
});
