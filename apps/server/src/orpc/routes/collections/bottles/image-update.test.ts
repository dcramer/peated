import { db } from "@peated/server/db";
import {
  bottleReleases,
  bottles,
  catalogTargets,
  collectionBottles,
} from "@peated/server/db/schema";
import { createPendingImageUpload } from "@peated/server/lib/pendingUploads";
import waitError from "@peated/server/lib/test/waitError";
import { compressAndResizeImage } from "@peated/server/lib/uploads";
import { routerClient } from "@peated/server/orpc/router";
import { and, eq, isNull } from "drizzle-orm";
import { describe, expect, test } from "vitest";

async function exactTargetId(bottleId: number) {
  const target = await db.query.catalogTargets.findFirst({
    where: eq(catalogTargets.bottleId, bottleId),
  });
  if (!target) throw new Error("Exact target fixture missing");
  return target.id;
}

async function genericTargetId(groupId: number) {
  const target = await db.query.catalogTargets.findFirst({
    where: and(
      eq(catalogTargets.groupId, groupId),
      isNull(catalogTargets.bottleId),
    ),
  });
  if (!target) throw new Error("Generic target fixture missing");
  return target.id;
}

describe("PUT /users/:user/collections/:collection/bottles/:collectionBottle/image", () => {
  test("requires authentication", async () => {
    const err = await waitError(() =>
      routerClient.collections.bottles.imageUpdate({
        user: "me",
        collection: "library",
        collectionBottle: 1,
        pendingImageId: "pending-image",
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("replaces a library entry image", async ({ fixtures, defaults }) => {
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
        targetId: await exactTargetId(bottle.id),
        imageUrl: "/uploads/collection-bottles/old.webp",
      })
      .returning();
    const pendingUpload = await createPendingImageUpload({
      file: await fixtures.SampleSquareImage(),
      createdById: defaults.user.id,
      purpose: "photo_tasting_entry",
      onProcess: (...args) => compressAndResizeImage(...args, 1600, 1600),
    });

    const result = await routerClient.collections.bottles.imageUpdate(
      {
        user: "me",
        collection: "library",
        collectionBottle: entry.id,
        pendingImageId: pendingUpload.id,
      },
      { context: { user: defaults.user } },
    );

    expect(result.id).toBe(entry.id);
    expect(result.target.kind).toBe("bottle");
    expect(result.imageUrl).toContain("/uploads/collection-bottles/");

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

    expect(updatedEntry.imageUrl).toMatch(
      /^\/uploads\/collection-bottles\/collection_bottle-\d+-pending-upload-.+\.webp$/,
    );
    expect(canonicalBottle?.imageUrl).toBe("/uploads/bottles/canonical.webp");
    expect(canonicalRelease?.imageUrl).toBe(
      "/uploads/bottle-releases/canonical-release.webp",
    );
  });

  test("returns the generic target after replacing its entry image", async ({
    fixtures,
    defaults,
  }) => {
    const retainedBottle = await fixtures.Bottle();
    const libraryCollection = await fixtures.Collection({
      name: "Library",
      createdById: defaults.user.id,
    });
    const targetId = await genericTargetId(retainedBottle.groupId as number);
    const [entry] = await db
      .insert(collectionBottles)
      .values({
        collectionId: libraryCollection.id,
        bottleId: retainedBottle.id,
        targetId,
      })
      .returning();
    const pendingUpload = await createPendingImageUpload({
      file: await fixtures.SampleSquareImage(),
      createdById: defaults.user.id,
      purpose: "photo_tasting_entry",
      onProcess: (...args) => compressAndResizeImage(...args, 1600, 1600),
    });

    const result = await routerClient.collections.bottles.imageUpdate(
      {
        user: "me",
        collection: "library",
        collectionBottle: entry.id,
        pendingImageId: pendingUpload.id,
      },
      { context: { user: defaults.user } },
    );

    expect(result).toMatchObject({
      id: entry.id,
      target: { kind: "group", targetId },
    });
    expect(result.target).not.toHaveProperty("bottle");
    expect(result.imageUrl).toContain("/uploads/collection-bottles/");
  });

  test("rejects replacing another user's library entry image", async ({
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
      })
      .returning();
    const pendingUpload = await createPendingImageUpload({
      file: await fixtures.SampleSquareImage(),
      createdById: defaults.user.id,
      purpose: "photo_tasting_entry",
      onProcess: (...args) => compressAndResizeImage(...args, 1600, 1600),
    });

    const err = await waitError(() =>
      routerClient.collections.bottles.imageUpdate(
        {
          user: otherUser.id,
          collection: "library",
          collectionBottle: entry.id,
          pendingImageId: pendingUpload.id,
        },
        { context: { user: defaults.user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(
      `[Error: Cannot modify another user's collection.]`,
    );
  });

  test("rejects expired pending image without changing existing image", async ({
    fixtures,
    defaults,
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
        imageUrl: "/uploads/collection-bottles/existing.webp",
      })
      .returning();
    const pendingUpload = await createPendingImageUpload({
      file: await fixtures.SampleSquareImage(),
      createdById: defaults.user.id,
      purpose: "photo_tasting_entry",
      ttlMs: -1000,
      onProcess: (...args) => compressAndResizeImage(...args, 1600, 1600),
    });

    const err = await waitError(() =>
      routerClient.collections.bottles.imageUpdate(
        {
          user: "me",
          collection: "library",
          collectionBottle: entry.id,
          pendingImageId: pendingUpload.id,
        },
        { context: { user: defaults.user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Pending upload has expired.]`);

    const [updatedEntry] = await db
      .select()
      .from(collectionBottles)
      .where(eq(collectionBottles.id, entry.id));
    expect(updatedEntry.imageUrl).toBe(
      "/uploads/collection-bottles/existing.webp",
    );
  });

  test("rejects replacing images outside Library", async ({
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
      })
      .returning();
    const pendingUpload = await createPendingImageUpload({
      file: await fixtures.SampleSquareImage(),
      createdById: defaults.user.id,
      purpose: "photo_tasting_entry",
      onProcess: (...args) => compressAndResizeImage(...args, 1600, 1600),
    });

    const err = await waitError(() =>
      routerClient.collections.bottles.imageUpdate(
        {
          user: "me",
          collection: "default",
          collectionBottle: entry.id,
          pendingImageId: pendingUpload.id,
        },
        { context: { user: defaults.user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(
      `[Error: Collection images are only supported for Library entries.]`,
    );
  });
});
