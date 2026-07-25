import { db } from "@peated/server/db";
import {
  bottleGroupTombstones,
  bottleTombstones,
  collectionBottles,
  collections,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { and, eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("POST /users/:user/collections/:collection/bottles", () => {
  test("requires authentication", async () => {
    const error = await waitError(() =>
      routerClient.collections.bottles.create({
        user: "me",
        collection: "default",
        bottle: 1,
      }),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("adds and returns one independently complete Bottle", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const collection = await fixtures.Collection({
      createdById: defaults.user.id,
      totalBottles: 0,
    });

    const result = await routerClient.collections.bottles.create(
      {
        user: "me",
        collection: collection.id,
        bottle: bottle.id,
      },
      { context: { user: defaults.user } },
    );

    expect(result).toMatchObject({
      bottle: {
        id: bottle.id,
        name: bottle.name,
        fullName: bottle.fullName,
      },
      hasTasted: false,
    });
    expect(result).not.toHaveProperty("target");
    expect(
      await db.query.collectionBottles.findFirst({
        where: and(
          eq(collectionBottles.collectionId, collection.id),
          eq(collectionBottles.bottleId, bottle.id),
        ),
      }),
    ).toMatchObject({
      bottleId: bottle.id,
      releaseId: null,
    });
    expect(
      await db.query.collections.findFirst({
        where: eq(collections.id, collection.id),
      }),
    ).toMatchObject({ totalBottles: 1 });
  });

  test("deduplicates direct Bottle membership", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const collection = await fixtures.Collection({
      createdById: defaults.user.id,
      totalBottles: 0,
    });
    const input = {
      user: "me" as const,
      collection: collection.id,
      bottle: bottle.id,
    };

    const first = await routerClient.collections.bottles.create(input, {
      context: { user: defaults.user },
    });
    const second = await routerClient.collections.bottles.create(input, {
      context: { user: defaults.user },
    });

    expect(second.id).toBe(first.id);
    expect(
      await db.query.collectionBottles.findMany({
        where: and(
          eq(collectionBottles.collectionId, collection.id),
          eq(collectionBottles.bottleId, bottle.id),
        ),
      }),
    ).toHaveLength(1);
    expect(
      await db.query.collections.findFirst({
        where: eq(collections.id, collection.id),
      }),
    ).toMatchObject({ totalBottles: 1 });
  });

  test("rejects Bottles that are not assigned to a BottleGroup", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.LegacyBottle();
    const collection = await fixtures.Collection({
      createdById: defaults.user.id,
    });

    const error = await waitError(() =>
      routerClient.collections.bottles.create(
        {
          user: "me",
          collection: collection.id,
          bottle: bottle.id,
        },
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchInlineSnapshot(
      `[Error: Bottle is not ready for collection activity.]`,
    );
    expect(
      await db.query.collectionBottles.findFirst({
        where: eq(collectionBottles.collectionId, collection.id),
      }),
    ).toBeUndefined();
  });

  test("preserves the missing Bottle error contract", async ({
    defaults,
    fixtures,
  }) => {
    const collection = await fixtures.Collection({
      createdById: defaults.user.id,
    });

    const error = await waitError(() =>
      routerClient.collections.bottles.create(
        {
          user: "me",
          collection: collection.id,
          bottle: Number.MAX_SAFE_INTEGER,
        },
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchObject({
      code: "NOT_FOUND",
      message: "Cannot find bottle.",
    });
  });

  test("rejects a retired Bottle", async ({ defaults, fixtures }) => {
    const bottle = await fixtures.Bottle();
    const replacement = await fixtures.Bottle();
    const collection = await fixtures.Collection({
      createdById: defaults.user.id,
    });
    await db.insert(bottleTombstones).values({
      bottleId: bottle.id,
      newBottleId: replacement.id,
    });

    const error = await waitError(() =>
      routerClient.collections.bottles.create(
        {
          user: "me",
          collection: collection.id,
          bottle: bottle.id,
        },
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchInlineSnapshot(
      `[Error: Bottle is not ready for collection activity.]`,
    );
    expect(
      await db.query.collectionBottles.findFirst({
        where: eq(collectionBottles.collectionId, collection.id),
      }),
    ).toBeUndefined();
  });

  test("rejects a Bottle in a retired BottleGroup", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const replacement = await fixtures.Bottle();
    const collection = await fixtures.Collection({
      createdById: defaults.user.id,
    });
    if (bottle.groupId === null || replacement.groupId === null) {
      throw new Error("BottleGroup fixtures not found.");
    }
    await db.insert(bottleGroupTombstones).values({
      groupId: bottle.groupId,
      newGroupId: replacement.groupId,
      createdByActorId: bottle.createdByActorId,
    });

    const error = await waitError(() =>
      routerClient.collections.bottles.create(
        {
          user: "me",
          collection: collection.id,
          bottle: bottle.id,
        },
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchInlineSnapshot(
      `[Error: Bottle is not ready for collection activity.]`,
    );
    expect(
      await db.query.collectionBottles.findFirst({
        where: eq(collectionBottles.collectionId, collection.id),
      }),
    ).toBeUndefined();
  });

  test("rejects the removed target input", async ({ defaults, fixtures }) => {
    const bottle = await fixtures.Bottle();
    const collection = await fixtures.Collection({
      createdById: defaults.user.id,
    });
    type Input = Parameters<typeof routerClient.collections.bottles.create>[0];

    const error = await waitError(() =>
      routerClient.collections.bottles.create(
        {
          user: "me",
          collection: collection.id,
          bottle: bottle.id,
          target: 1,
        } as unknown as Input,
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchObject({
      code: "BAD_REQUEST",
      message: "Input validation failed",
    });
  });
});
