import { db } from "@peated/server/db";
import {
  bottleTombstones,
  bottles,
  collectionBottles,
  collections,
  pendingUploads,
} from "@peated/server/db/schema";
import { createPendingImageUpload } from "@peated/server/lib/pendingUploads";
import waitError from "@peated/server/lib/test/waitError";
import { compressAndResizeImage } from "@peated/server/lib/uploads";
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
    ).toMatchObject({ bottleId: bottle.id });
    expect(
      await db.query.collections.findFirst({
        where: eq(collections.id, collection.id),
      }),
    ).toMatchObject({ totalBottles: 1 });
  });

  test("keeps same-group Bottles as distinct memberships", async ({
    defaults,
    fixtures,
  }) => {
    const firstBottle = await fixtures.Bottle({ name: "Shared Family" });
    if (firstBottle.groupId === null) {
      throw new Error("Expected grouped Bottle fixture.");
    }
    const secondBottle = await fixtures.BottleGroupMember({
      groupId: firstBottle.groupId,
      edition: "Batch 2",
    });
    const collection = await fixtures.Collection({
      createdById: defaults.user.id,
      totalBottles: 0,
    });

    const first = await routerClient.collections.bottles.create(
      {
        user: "me",
        collection: collection.id,
        bottle: firstBottle.id,
      },
      { context: { user: defaults.user } },
    );
    const second = await routerClient.collections.bottles.create(
      {
        user: "me",
        collection: collection.id,
        bottle: secondBottle.id,
      },
      { context: { user: defaults.user } },
    );

    expect(first.bottle.id).toBe(firstBottle.id);
    expect(second.bottle.id).toBe(secondBottle.id);
    expect(first.id).not.toBe(second.id);
    expect(
      await db.query.collectionBottles.findMany({
        where: eq(collectionBottles.collectionId, collection.id),
        columns: { bottleId: true },
      }),
    ).toEqual(
      expect.arrayContaining([
        { bottleId: firstBottle.id },
        { bottleId: secondBottle.id },
      ]),
    );
    expect(
      await db.query.collections.findFirst({
        where: eq(collections.id, collection.id),
      }),
    ).toMatchObject({ totalBottles: 2 });
  });

  test("stores the selected exact Bottle", async ({ defaults, fixtures }) => {
    const firstBottle = await fixtures.Bottle({ name: "Collection Family" });
    if (firstBottle.groupId === null) {
      throw new Error("Expected grouped Bottle fixture.");
    }
    const selectedBottle = await fixtures.BottleGroupMember({
      groupId: firstBottle.groupId,
      edition: "Batch 2",
    });
    const collection = await fixtures.Collection({
      createdById: defaults.user.id,
    });

    const result = await routerClient.collections.bottles.create(
      {
        user: "me",
        collection: collection.id,
        bottle: selectedBottle.id,
      },
      { context: { user: defaults.user } },
    );

    expect(result.bottle).toMatchObject({
      id: selectedBottle.id,
      fullName: selectedBottle.fullName,
    });
    expect(result.bottle.id).not.toBe(firstBottle.id);
    expect(
      await db.query.collectionBottles.findFirst({
        where: eq(collectionBottles.collectionId, collection.id),
        columns: { bottleId: true },
      }),
    ).toEqual({ bottleId: selectedBottle.id });
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

  test("stores Library status and entry image without changing the Bottle image", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({
      imageUrl: "/uploads/bottles/canonical.webp",
    });
    const pendingUpload = await createPendingImageUpload({
      file: await fixtures.SampleSquareImage(),
      createdById: defaults.user.id,
      purpose: "photo_tasting_entry",
      onProcess: (...args) => compressAndResizeImage(...args, 1600, 1600),
    });

    const result = await routerClient.collections.bottles.create(
      {
        user: "me",
        collection: "library",
        bottle: bottle.id,
        pendingImageId: pendingUpload.id,
        status: "sealed",
      },
      { context: { user: defaults.user } },
    );

    expect(result).toMatchObject({
      bottle: { id: bottle.id },
      status: "sealed",
    });
    expect(result.imageUrl).toContain("/uploads/collection-bottles/");
    expect(
      await db.query.collectionBottles.findFirst({
        where: eq(collectionBottles.id, result.id),
        columns: { bottleId: true, imageUrl: true, status: true },
      }),
    ).toMatchObject({
      bottleId: bottle.id,
      imageUrl: expect.stringMatching(
        /^\/uploads\/collection-bottles\/collection_bottle-\d+-pending-upload-.+\.webp$/,
      ),
      status: "sealed",
    });
    expect(
      await db.query.bottles.findFirst({
        where: eq(bottles.id, bottle.id),
        columns: { imageUrl: true },
      }),
    ).toEqual({ imageUrl: "/uploads/bottles/canonical.webp" });
  });

  test("updates an existing Library membership only from supplied fields", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const firstUpload = await createPendingImageUpload({
      file: await fixtures.SampleSquareImage(),
      createdById: defaults.user.id,
      purpose: "photo_tasting_entry",
      onProcess: (...args) => compressAndResizeImage(...args, 1600, 1600),
    });
    const secondUpload = await createPendingImageUpload({
      file: await fixtures.SampleSquareImage(),
      createdById: defaults.user.id,
      purpose: "photo_tasting_entry",
      onProcess: (...args) => compressAndResizeImage(...args, 1600, 1600),
    });

    const created = await routerClient.collections.bottles.create(
      {
        user: "me",
        collection: "library",
        bottle: bottle.id,
        pendingImageId: firstUpload.id,
        status: "open",
      },
      { context: { user: defaults.user } },
    );
    const unchanged = await routerClient.collections.bottles.create(
      {
        user: "me",
        collection: "library",
        bottle: bottle.id,
      },
      { context: { user: defaults.user } },
    );
    const statusUpdated = await routerClient.collections.bottles.create(
      {
        user: "me",
        collection: "library",
        bottle: bottle.id,
        status: "empty",
      },
      { context: { user: defaults.user } },
    );
    const imageUpdated = await routerClient.collections.bottles.create(
      {
        user: "me",
        collection: "library",
        bottle: bottle.id,
        pendingImageId: secondUpload.id,
      },
      { context: { user: defaults.user } },
    );

    expect(unchanged).toMatchObject({
      id: created.id,
      imageUrl: created.imageUrl,
      status: "open",
    });
    expect(statusUpdated).toMatchObject({
      id: created.id,
      imageUrl: created.imageUrl,
      status: "empty",
    });
    expect(imageUpdated.id).toBe(created.id);
    expect(imageUpdated.imageUrl).not.toBe(created.imageUrl);
    expect(imageUpdated.status).toBe("empty");
    expect(
      await db.query.collectionBottles.findMany({
        where: eq(collectionBottles.bottleId, bottle.id),
      }),
    ).toHaveLength(1);
  });

  test("rejects status and entry images outside Library", async ({
    defaults,
    fixtures,
  }) => {
    const statusBottle = await fixtures.Bottle();
    const imageBottle = await fixtures.Bottle();
    const pendingUpload = await createPendingImageUpload({
      file: await fixtures.SampleSquareImage(),
      createdById: defaults.user.id,
      purpose: "photo_tasting_entry",
      onProcess: (...args) => compressAndResizeImage(...args, 1600, 1600),
    });

    const statusError = await waitError(() =>
      routerClient.collections.bottles.create(
        {
          user: "me",
          collection: "default",
          bottle: statusBottle.id,
          status: "open",
        },
        { context: { user: defaults.user } },
      ),
    );
    const imageError = await waitError(() =>
      routerClient.collections.bottles.create(
        {
          user: "me",
          collection: "default",
          bottle: imageBottle.id,
          pendingImageId: pendingUpload.id,
        },
        { context: { user: defaults.user } },
      ),
    );

    expect(statusError).toMatchInlineSnapshot(
      `[Error: Bottle status is only supported for Library entries.]`,
    );
    expect(imageError).toMatchInlineSnapshot(
      `[Error: Collection images are only supported for Library entries.]`,
    );
    expect(
      await db.query.collectionBottles.findMany({
        where: (collectionBottles, { inArray }) =>
          inArray(collectionBottles.bottleId, [
            statusBottle.id,
            imageBottle.id,
          ]),
      }),
    ).toHaveLength(0);
  });

  test("rolls back a new Library membership when image copying fails", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const pendingUpload = await createPendingImageUpload({
      file: await fixtures.SampleSquareImage(),
      createdById: defaults.user.id,
      purpose: "photo_tasting_entry",
      onProcess: (...args) => compressAndResizeImage(...args, 1600, 1600),
    });
    await db
      .update(pendingUploads)
      .set({ imageUrl: "/uploads/pending-uploads/missing-source.webp" })
      .where(eq(pendingUploads.id, pendingUpload.id));

    const error = await waitError(() =>
      routerClient.collections.bottles.create(
        {
          user: "me",
          collection: "library",
          bottle: bottle.id,
          pendingImageId: pendingUpload.id,
        },
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchObject({ code: "ENOENT" });
    expect(
      await db.query.collectionBottles.findFirst({
        where: eq(collectionBottles.bottleId, bottle.id),
      }),
    ).toBeUndefined();
    expect(
      await db.query.collections.findFirst({
        where: and(
          eq(collections.createdById, defaults.user.id),
          eq(collections.name, "Library"),
        ),
      }),
    ).toMatchObject({ totalBottles: 0 });
  });

  test("rejects writes to another user's collection", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const otherUser = await fixtures.User();
    const collection = await fixtures.Collection({
      createdById: otherUser.id,
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
      `[Error: Cannot modify another user's collection.]`,
    );
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

  test("rejects the removed target input", async ({ defaults, fixtures }) => {
    const bottle = await fixtures.Bottle();
    const collection = await fixtures.Collection({
      createdById: defaults.user.id,
    });
    const error = await waitError(() =>
      routerClient.collections.bottles.create(
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
  });
});
