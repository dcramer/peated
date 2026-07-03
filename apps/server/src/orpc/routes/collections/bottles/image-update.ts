import { db } from "@peated/server/db";
import { collectionBottles } from "@peated/server/db/schema";
import { getUserFromId } from "@peated/server/lib/api";
import {
  getReservedCollection,
  isReservedCollectionSlug,
  reservedCollectionSlugs,
} from "@peated/server/lib/db";
import { PendingUploadError } from "@peated/server/lib/pendingUploads";
import { procedure } from "@peated/server/orpc";
import {
  requireAuth,
  requireTosAccepted,
} from "@peated/server/orpc/middleware";
import { CollectionBottleSchema } from "@peated/server/schemas";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  copyPendingImageForCollectionBottle,
  findCollectionBottleWithTarget,
  isLibraryCollection,
  serializeCollectionBottleEntry,
} from "./imageHelpers";

async function findCollectionById(collectionId: number) {
  return await db.query.collections.findFirst({
    where: (collections, { eq }) => eq(collections.id, collectionId),
  });
}

export default procedure
  .use(requireAuth)
  .use(requireTosAccepted)
  .route({
    method: "PUT",
    path: "/users/{user}/collections/{collection}/bottles/{collectionBottle}/image",
    summary: "Replace collection bottle image",
    description:
      "Replace the image for a collection bottle entry. Requires authentication and ownership",
    operationId: "updateCollectionBottleImage",
  })
  .input(
    z.object({
      collection: z.union([z.enum(reservedCollectionSlugs), z.coerce.number()]),
      collectionBottle: z.coerce.number(),
      pendingImageId: z.string().trim().min(1),
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
      ? await getReservedCollection(db, user.id, input.collection)
      : await findCollectionById(input.collection);

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
    if (!isLibraryCollection(collection)) {
      throw errors.BAD_REQUEST({
        message: "Collection images are only supported for Library entries.",
      });
    }

    const collectionBottle = await findCollectionBottleWithTarget({
      collectionBottleId: input.collectionBottle,
      collectionId: collection.id,
    });
    if (!collectionBottle) {
      throw errors.NOT_FOUND({
        message: "Collection bottle not found.",
      });
    }

    let imageUrl: string;
    try {
      imageUrl = await copyPendingImageForCollectionBottle({
        pendingImageId: input.pendingImageId,
        userId: context.user.id,
        collectionBottleId: collectionBottle.id,
      });
    } catch (err) {
      if (err instanceof PendingUploadError) {
        throw errors.BAD_REQUEST({
          message: err.message || "Pending photo is no longer available.",
        });
      }
      throw err;
    }

    await db
      .update(collectionBottles)
      .set({ imageUrl })
      .where(eq(collectionBottles.id, collectionBottle.id));

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
