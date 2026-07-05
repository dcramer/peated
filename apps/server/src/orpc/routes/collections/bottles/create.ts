import { db } from "@peated/server/db";
import type { CollectionBottle } from "@peated/server/db/schema";
import {
  bottleReleases,
  bottles,
  collectionBottles,
  collections,
} from "@peated/server/db/schema";
import { getUserFromId } from "@peated/server/lib/api";
import {
  getReservedCollection,
  isReservedCollectionSlug,
  reservedCollectionSlugs,
} from "@peated/server/lib/db";
import { logError } from "@peated/server/lib/log";
import { PendingUploadError } from "@peated/server/lib/pendingUploads";
import { procedure } from "@peated/server/orpc";
import {
  requireAuth,
  requireTosAccepted,
} from "@peated/server/orpc/middleware";
import {
  CollectionBottleInputSchema,
  CollectionBottleSchema,
} from "@peated/server/schemas";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import {
  copyPendingImageForCollectionBottle,
  findCollectionBottleWithTarget,
  isLibraryCollection,
  serializeCollectionBottleEntry,
  validatePendingImageForCollectionBottle,
} from "./imageHelpers";

export default procedure
  .use(requireAuth)
  .use(requireTosAccepted)
  .route({
    method: "POST",
    path: "/users/{user}/collections/{collection}/bottles",
    summary: "Add bottle to collection",
    description:
      "Add a bottle (and optionally a specific release) to a user's collection. Requires authentication and ownership",
    operationId: "addBottleToCollection",
  })
  .input(
    CollectionBottleInputSchema.extend({
      collection: z.union([z.enum(reservedCollectionSlugs), z.coerce.number()]),
      pendingImageId: z.string().trim().min(1).optional(),
      user: z.union([z.literal("me"), z.coerce.number(), z.string()]),
    }),
  )
  .output(CollectionBottleSchema)
  .handler(async function ({ input, context, errors }) {
    const user = await getUserFromId(db, input.user, context.user);
    if (!user) {
      throw errors.NOT_FOUND({
        message: "User not found.",
      });
    }

    if (user.id !== context.user.id) {
      throw errors.FORBIDDEN({
        message: "Cannot modify another user's collection.",
      });
    }

    const collection = isReservedCollectionSlug(input.collection)
      ? await getReservedCollection(db, user.id, input.collection, {
          create: true,
        })
      : await db.query.collections.findFirst({
          where: (collections, { eq }) =>
            eq(collections.id, input.collection as number),
        });

    if (!collection) {
      throw errors.NOT_FOUND({
        message: "Collection not found.",
      });
    }

    if (context.user.id !== collection.createdById) {
      throw errors.FORBIDDEN({
        message: "Cannot modify another user's collection.",
      });
    }

    const [bottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, input.bottle));
    if (!bottle) {
      throw errors.NOT_FOUND({
        message: "Cannot find bottle.",
      });
    }

    if (input.release) {
      const release = await db.query.bottleReleases.findFirst({
        where: and(
          eq(bottleReleases.id, input.release),
          eq(bottleReleases.bottleId, bottle.id),
        ),
      });
      if (!release) {
        throw errors.BAD_REQUEST({
          message: "Cannot identify release.",
        });
      }
    }

    if (input.pendingImageId) {
      if (!isLibraryCollection(collection)) {
        throw errors.BAD_REQUEST({
          message: "Collection images are only supported for Library entries.",
        });
      }
      try {
        await validatePendingImageForCollectionBottle({
          pendingImageId: input.pendingImageId,
          userId: context.user.id,
        });
      } catch (err) {
        if (err instanceof PendingUploadError) {
          throw errors.BAD_REQUEST({
            message: err.message || "Pending photo is no longer available.",
          });
        }
        throw err;
      }
    }

    let collectionBottleResult:
      | { collectionBottle: CollectionBottle; created: boolean }
      | null
      | undefined;
    collectionBottleResult = await db.transaction(async (tx) => {
      const [createdCollectionBottle] = await tx
        .insert(collectionBottles)
        .values({
          collectionId: collection.id,
          bottleId: bottle.id,
          releaseId: input.release ?? null,
        })
        .onConflictDoNothing()
        .returning();

      let collectionBottle = createdCollectionBottle;
      if (collectionBottle) {
        await tx
          .update(collections)
          .set({
            totalBottles: sql`${collections.totalBottles} + 1`,
          })
          .where(eq(collections.id, collection.id));
        return { collectionBottle, created: true };
      } else {
        const [existingCollectionBottle] = await tx
          .select()
          .from(collectionBottles)
          .where(
            and(
              eq(collectionBottles.collectionId, collection.id),
              eq(collectionBottles.bottleId, bottle.id),
              input.release != null
                ? eq(collectionBottles.releaseId, input.release)
                : isNull(collectionBottles.releaseId),
            ),
          )
          .limit(1);
        collectionBottle = existingCollectionBottle;
      }

      if (!collectionBottle) {
        return null;
      }

      return { collectionBottle, created: false };
    });

    if (!collectionBottleResult) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Unable to save collection bottle.",
      });
    }

    let collectionBottle = collectionBottleResult.collectionBottle;
    if (input.pendingImageId) {
      const removeCreatedCollectionBottle = async () => {
        if (!collectionBottleResult.created) {
          return;
        }

        await db.transaction(async (tx) => {
          await tx
            .delete(collectionBottles)
            .where(eq(collectionBottles.id, collectionBottle.id));
          await tx
            .update(collections)
            .set({
              totalBottles: sql`${collections.totalBottles} - 1`,
            })
            .where(eq(collections.id, collection.id));
        });
      };

      try {
        const imageUrl = await copyPendingImageForCollectionBottle({
          pendingImageId: input.pendingImageId,
          userId: context.user.id,
          collectionBottleId: collectionBottle.id,
        });

        const [updatedCollectionBottle] = await db
          .update(collectionBottles)
          .set({ imageUrl })
          .where(eq(collectionBottles.id, collectionBottle.id))
          .returning();

        if (!updatedCollectionBottle) {
          throw errors.INTERNAL_SERVER_ERROR({
            message: "Unable to save collection bottle image.",
          });
        }

        collectionBottle = updatedCollectionBottle;
      } catch (err) {
        if (err instanceof PendingUploadError) {
          await removeCreatedCollectionBottle();

          throw errors.BAD_REQUEST({
            message: err.message || "Pending photo is no longer available.",
          });
        }

        logError(err, {
          collection: {
            id: collection.id,
          },
          collectionBottle: {
            id: collectionBottle.id,
          },
          pendingUpload: {
            id: input.pendingImageId,
          },
          user: {
            id: context.user.id,
          },
        });
        await removeCreatedCollectionBottle();
        throw err;
      }
    }

    const result = await findCollectionBottleWithTarget({
      collectionBottleId: collectionBottle.id,
      collectionId: collection.id,
    });
    if (!result) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Unable to load collection bottle.",
      });
    }

    return await serializeCollectionBottleEntry(result, context.user);
  });
