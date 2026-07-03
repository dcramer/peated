import { db } from "@peated/server/db";
import {
  bottleReleases,
  bottles,
  collectionBottles,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("DELETE /users/:user/collections/:collection/bottles/:collectionBottle/image", () => {
  test("requires authentication", async () => {
    const err = await waitError(() =>
      routerClient.collections.bottles.imageDelete({
        user: "me",
        collection: "library",
        collectionBottle: 1,
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("removes a library entry image", async ({ fixtures, defaults }) => {
    const bottle = await fixtures.Bottle({
      imageUrl: "/uploads/bottles/canonical.webp",
    });
    const release = await fixtures.BottleRelease({
      bottleId: bottle.id,
      imageUrl: "/uploads/bottle-releases/canonical-release.webp",
    });
    const libraryCollection = await fixtures.Collection({
      name: "Library",
      createdById: defaults.user.id,
    });
    const [entry] = await db
      .insert(collectionBottles)
      .values({
        collectionId: libraryCollection.id,
        bottleId: bottle.id,
        releaseId: release.id,
        imageUrl: "/uploads/collection-bottles/entry.webp",
      })
      .returning();

    const result = await routerClient.collections.bottles.imageDelete(
      {
        user: "me",
        collection: "library",
        collectionBottle: entry.id,
      },
      { context: { user: defaults.user } },
    );

    expect(result.id).toBe(entry.id);
    expect(result.imageUrl).toBeNull();

    const [updatedEntry] = await db
      .select()
      .from(collectionBottles)
      .where(eq(collectionBottles.id, entry.id));
    const canonicalBottle = await db.query.bottles.findFirst({
      where: eq(bottles.id, bottle.id),
    });
    const canonicalRelease = await db.query.bottleReleases.findFirst({
      where: eq(bottleReleases.id, release.id),
    });

    expect(updatedEntry.imageUrl).toBeNull();
    expect(canonicalBottle?.imageUrl).toBe("/uploads/bottles/canonical.webp");
    expect(canonicalRelease?.imageUrl).toBe(
      "/uploads/bottle-releases/canonical-release.webp",
    );
  });

  test("rejects removing another user's library entry image", async ({
    fixtures,
    defaults,
  }) => {
    const otherUser = await fixtures.User();
    const bottle = await fixtures.Bottle();
    const otherLibraryCollection = await fixtures.Collection({
      name: "Library",
      createdById: otherUser.id,
    });
    const [entry] = await db
      .insert(collectionBottles)
      .values({
        collectionId: otherLibraryCollection.id,
        bottleId: bottle.id,
        releaseId: null,
        imageUrl: "/uploads/collection-bottles/entry.webp",
      })
      .returning();

    const err = await waitError(() =>
      routerClient.collections.bottles.imageDelete(
        {
          user: otherUser.id,
          collection: "library",
          collectionBottle: entry.id,
        },
        { context: { user: defaults.user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(
      `[Error: Cannot modify another user's collection.]`,
    );

    const [updatedEntry] = await db
      .select()
      .from(collectionBottles)
      .where(eq(collectionBottles.id, entry.id));
    expect(updatedEntry.imageUrl).toBe(
      "/uploads/collection-bottles/entry.webp",
    );
  });

  test("rejects removing images outside Library", async ({
    fixtures,
    defaults,
  }) => {
    const bottle = await fixtures.Bottle();
    const defaultCollection = await fixtures.Collection({
      name: "Default",
      createdById: defaults.user.id,
    });
    const [entry] = await db
      .insert(collectionBottles)
      .values({
        collectionId: defaultCollection.id,
        bottleId: bottle.id,
        releaseId: null,
        imageUrl: "/uploads/collection-bottles/entry.webp",
      })
      .returning();

    const err = await waitError(() =>
      routerClient.collections.bottles.imageDelete(
        {
          user: "me",
          collection: "default",
          collectionBottle: entry.id,
        },
        { context: { user: defaults.user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(
      `[Error: Collection images are only supported for Library entries.]`,
    );

    const [updatedEntry] = await db
      .select()
      .from(collectionBottles)
      .where(eq(collectionBottles.id, entry.id));
    expect(updatedEntry.imageUrl).toBe(
      "/uploads/collection-bottles/entry.webp",
    );
  });
});
