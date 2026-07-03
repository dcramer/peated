import { db } from "@peated/server/db";
import { collectionBottles } from "@peated/server/db/schema";
import { getUserFromId } from "@peated/server/lib/api";
import {
  getReservedCollection,
  isReservedCollectionSlug,
  reservedCollectionSlugs,
} from "@peated/server/lib/db";
import { procedure } from "@peated/server/orpc";
import {
  requireAuth,
  requireTosAccepted,
} from "@peated/server/orpc/middleware";
import { CollectionBottleSchema } from "@peated/server/schemas";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
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
    method: "DELETE",
    path: "/users/{user}/collections/{collection}/bottles/{collectionBottle}/image",
    summary: "Remove collection bottle image",
    description:
      "Remove the image from a collection bottle entry. Requires authentication and ownership",
    operationId: "deleteCollectionBottleImage",
  })
  .input(
    z.object({
      collection: z.union([z.enum(reservedCollectionSlugs), z.coerce.number()]),
      collectionBottle: z.coerce.number(),
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

    await db
      .update(collectionBottles)
      .set({ imageUrl: null })
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
