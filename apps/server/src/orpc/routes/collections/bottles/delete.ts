import { RESERVED_COLLECTION_SLUGS } from "@peated/server/constants";
import { db } from "@peated/server/db";
import { collectionBottles, collections } from "@peated/server/db/schema";
import { getUserFromId } from "@peated/server/lib/api";
import {
  getReservedCollection,
  isReservedCollectionSlug,
} from "@peated/server/lib/db";
import { procedure } from "@peated/server/orpc";
import {
  requireAuth,
  requireTosAccepted,
} from "@peated/server/orpc/middleware";
import { CollectionBottleInputSchema } from "@peated/server/schemas";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

const CollectionBottleDeleteFields = {
  collection: z.union([z.enum(RESERVED_COLLECTION_SLUGS), z.coerce.number()]),
  user: z.union([z.literal("me"), z.coerce.number(), z.string()]),
} as const;

const CollectionBottleDeleteInputSchema = CollectionBottleInputSchema.pick({
  bottle: true,
})
  .safeExtend(CollectionBottleDeleteFields)
  .strict();

export default procedure
  .use(requireAuth)
  .use(requireTosAccepted)
  .route({
    method: "DELETE",
    path: "/users/{user}/collections/{collection}/bottles",
    summary: "Remove a Bottle from a collection",
    description:
      "Remove one Bottle membership from a user's collection. Requires authentication and ownership.",
    operationId: "removeBottleFromCollection",
  })
  .input(CollectionBottleDeleteInputSchema)
  .output(z.object({}))
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

    const reservedCollection = isReservedCollectionSlug(input.collection)
      ? input.collection
      : null;
    const collection = reservedCollection
      ? await getReservedCollection(db, context.user.id, reservedCollection)
      : await db.query.collections.findFirst({
          where: (collections, { eq }) =>
            eq(collections.id, z.number().parse(input.collection)),
        });

    if (!collection) {
      if (reservedCollection) {
        return {};
      }

      throw errors.NOT_FOUND({
        message: "Collection not found.",
      });
    }

    if (context.user.id !== collection.createdById) {
      throw errors.FORBIDDEN({
        message: "Cannot modify another user's collection.",
      });
    }

    await db.transaction(async (tx) => {
      const deleted = await tx
        .delete(collectionBottles)
        .where(
          and(
            eq(collectionBottles.collectionId, collection.id),
            eq(collectionBottles.bottleId, input.bottle),
          ),
        )
        .returning();

      if (deleted.length) {
        await tx
          .update(collections)
          .set({
            totalBottles: sql`${collections.totalBottles} - ${deleted.length}`,
          })
          .where(eq(collections.id, collection.id));
      }
    });

    return {};
  });
