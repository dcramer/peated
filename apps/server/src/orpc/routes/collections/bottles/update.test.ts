import { db } from "@peated/server/db";
import { collectionBottles } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("PATCH /users/:user/collections/:collection/bottles/:collectionBottle", () => {
  test("requires authentication", async () => {
    const err = await waitError(() =>
      routerClient.collections.bottles.update({
        user: "me",
        collection: "library",
        collectionBottle: 1,
        status: "open",
      }),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("sets and clears library bottle status", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const libraryCollection = await fixtures.Collection({
      name: "Library",
      createdById: defaults.user.id,
    });
    const [entry] = await db
      .insert(collectionBottles)
      .values({
        collectionId: libraryCollection.id,
        bottleId: bottle.id,
        releaseId: null,
      })
      .returning();

    const updated = await routerClient.collections.bottles.update(
      {
        user: "me",
        collection: "library",
        collectionBottle: entry.id,
        status: "empty",
      },
      { context: { user: defaults.user } },
    );
    const cleared = await routerClient.collections.bottles.update(
      {
        user: "me",
        collection: "library",
        collectionBottle: entry.id,
        status: null,
      },
      { context: { user: defaults.user } },
    );

    const [row] = await db
      .select()
      .from(collectionBottles)
      .where(eq(collectionBottles.id, entry.id));

    expect(updated.id).toBe(entry.id);
    expect(updated.status).toBe("empty");
    expect(cleared.id).toBe(entry.id);
    expect(cleared.status).toBeNull();
    expect(row.status).toBeNull();
  });

  test("rejects updates by non-owner", async ({ defaults, fixtures }) => {
    const owner = await fixtures.User();
    const bottle = await fixtures.Bottle();
    const libraryCollection = await fixtures.Collection({
      name: "Library",
      createdById: owner.id,
    });
    const [entry] = await db
      .insert(collectionBottles)
      .values({
        collectionId: libraryCollection.id,
        bottleId: bottle.id,
        releaseId: null,
      })
      .returning();

    const err = await waitError(() =>
      routerClient.collections.bottles.update(
        {
          user: owner.id,
          collection: "library",
          collectionBottle: entry.id,
          status: "sealed",
        },
        { context: { user: defaults.user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(
      `[Error: Cannot modify another user's collection.]`,
    );
  });

  test("rejects status updates outside Library", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const collection = await fixtures.Collection({
      name: "Shelf",
      createdById: defaults.user.id,
    });
    const [entry] = await db
      .insert(collectionBottles)
      .values({
        collectionId: collection.id,
        bottleId: bottle.id,
        releaseId: null,
      })
      .returning();

    const err = await waitError(() =>
      routerClient.collections.bottles.update(
        {
          user: "me",
          collection: collection.id,
          collectionBottle: entry.id,
          status: "open",
        },
        { context: { user: defaults.user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(
      `[Error: Bottle status is only supported for Library entries.]`,
    );
  });

  test("rejects entries outside the selected collection", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const libraryCollection = await fixtures.Collection({
      name: "Library",
      createdById: defaults.user.id,
    });
    const otherCollection = await fixtures.Collection({
      name: "Other Shelf",
      createdById: defaults.user.id,
    });
    const [entry] = await db
      .insert(collectionBottles)
      .values({
        collectionId: otherCollection.id,
        bottleId: bottle.id,
        releaseId: null,
      })
      .returning();

    const err = await waitError(() =>
      routerClient.collections.bottles.update(
        {
          user: "me",
          collection: libraryCollection.id,
          collectionBottle: entry.id,
          status: "open",
        },
        { context: { user: defaults.user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Collection bottle not found.]`);
  });
});
