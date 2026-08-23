import { db } from "@peated/server/db";
import { collectionBottles, collections } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { and, eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("DELETE /users/:user/collections/:collection/bottles", () => {
  test("requires authentication", async () => {
    const error = await waitError(() =>
      routerClient.collections.bottles.delete({
        user: "me",
        collection: "default",
        bottle: 1,
      }),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("deletes direct Bottle membership and updates the collection count", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const collection = await fixtures.Collection({
      createdById: defaults.user.id,
      totalBottles: 1,
    });
    await db.insert(collectionBottles).values({
      collectionId: collection.id,
      bottleId: bottle.id,
    });

    await routerClient.collections.bottles.delete(
      {
        user: "me",
        collection: collection.id,
        bottle: bottle.id,
      },
      { context: { user: defaults.user } },
    );

    expect(
      await db.query.collectionBottles.findFirst({
        where: and(
          eq(collectionBottles.collectionId, collection.id),
          eq(collectionBottles.bottleId, bottle.id),
        ),
      }),
    ).toBeUndefined();
    expect(
      await db.query.collections.findFirst({
        where: eq(collections.id, collection.id),
      }),
    ).toMatchObject({ totalBottles: 0 });
  });

  test("does not remove another Bottle", async ({ defaults, fixtures }) => {
    const selected = await fixtures.Bottle();
    const retained = await fixtures.Bottle();
    const collection = await fixtures.Collection({
      createdById: defaults.user.id,
      totalBottles: 2,
    });
    await db.insert(collectionBottles).values([
      {
        collectionId: collection.id,
        bottleId: selected.id,
      },
      {
        collectionId: collection.id,
        bottleId: retained.id,
      },
    ]);

    await routerClient.collections.bottles.delete(
      {
        user: "me",
        collection: collection.id,
        bottle: selected.id,
      },
      { context: { user: defaults.user } },
    );

    expect(
      await db.query.collectionBottles.findMany({
        where: eq(collectionBottles.collectionId, collection.id),
      }),
    ).toMatchObject([{ bottleId: retained.id }]);
  });

  test("rejects the removed target input", async ({ defaults, fixtures }) => {
    const bottle = await fixtures.Bottle();
    const collection = await fixtures.Collection({
      createdById: defaults.user.id,
      totalBottles: 1,
    });
    await db.insert(collectionBottles).values({
      collectionId: collection.id,
      bottleId: bottle.id,
    });
    const error = await waitError(() =>
      routerClient.collections.bottles.delete(
        // SAFETY: This invalid legacy field exercises the runtime input boundary.
        {
          user: "me",
          collection: collection.id,
          bottle: bottle.id,
          target: 1,
        } as never,
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchObject({
      code: "BAD_REQUEST",
      message: "Input validation failed",
    });
    expect(
      await db.query.collectionBottles.findFirst({
        where: eq(collectionBottles.collectionId, collection.id),
      }),
    ).toBeDefined();
  });
});
