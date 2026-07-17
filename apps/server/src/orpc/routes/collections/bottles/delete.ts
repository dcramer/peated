import { db } from "@peated/server/db";
import { collectionBottles, collections } from "@peated/server/db/schema";
import { getUserFromId } from "@peated/server/lib/api";
import {
  isStagedTargetlessCatalogMappingError,
  lockCatalogTargetAssignmentDescriptorInTransaction,
  resolveCatalogTargetForAssignment,
} from "@peated/server/lib/catalogTargets";
import {
  getReservedCollection,
  isReservedCollectionSlug,
  reservedCollectionSlugs,
} from "@peated/server/lib/db";
import { logInfo } from "@peated/server/lib/log";
import { procedure } from "@peated/server/orpc";
import {
  requireAuth,
  requireTosAccepted,
} from "@peated/server/orpc/middleware";
import { CollectionBottleInputSchema } from "@peated/server/schemas";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAuth)
  .use(requireTosAccepted)
  .route({
    method: "DELETE",
    path: "/users/{user}/collections/{collection}/bottles",
    summary: "Remove bottle from collection",
    description:
      "Remove a bottle (and optionally a specific release) from a user's collection. Requires authentication and ownership",
    operationId: "removeBottleFromCollection",
  })
  .input(
    CollectionBottleInputSchema.extend({
      collection: z.union([z.enum(reservedCollectionSlugs), z.coerce.number()]),
      user: z.union([z.literal("me"), z.coerce.number(), z.string()]),
      baseOnly: z.coerce.boolean().optional(),
    }),
  )
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
            eq(collections.id, input.collection as number),
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
      const specificReleaseId = input.baseOnly ? null : (input.release ?? null);
      const hasSpecificIntent = input.baseOnly || input.release != null;
      let target = null;
      if (hasSpecificIntent) {
        // CatalogTarget must be locked before collection membership rows.
        try {
          target = await resolveCatalogTargetForAssignment(
            {
              kind: "legacy",
              bottleId: input.bottle,
              releaseId: specificReleaseId,
              context: {
                caller: "collections.bottles.delete",
                operation: input.baseOnly ? "deleteBase" : "deleteRelease",
              },
            },
            tx,
          );
        } catch (error) {
          if (!isStagedTargetlessCatalogMappingError(error)) throw error;
        }
      }

      if (target) {
        await lockCatalogTargetAssignmentDescriptorInTransaction(tx, target);
      }

      const targetlessPair = and(
        isNull(collectionBottles.targetId),
        eq(collectionBottles.bottleId, input.bottle),
        specificReleaseId === null
          ? isNull(collectionBottles.releaseId)
          : eq(collectionBottles.releaseId, specificReleaseId),
      );

      const deleted = await tx
        .delete(collectionBottles)
        .where(
          and(
            eq(collectionBottles.collectionId, collection.id),
            hasSpecificIntent
              ? target
                ? or(
                    eq(collectionBottles.targetId, target.targetId),
                    targetlessPair,
                  )
                : targetlessPair
              : eq(collectionBottles.bottleId, input.bottle),
          ),
        )
        .returning();

      if (!hasSpecificIntent) {
        // This legacy family operation intentionally spans multiple retained
        // identities. Exact removal uses baseOnly; task 9.7 removes this branch.
        logInfo("Legacy collection Bottle family compatibility write", {
          extra: {
            event: "collection_bottle.compatibility",
            caller: "collections.bottles.delete",
            operation: "deleteFamily",
            removalTask: "9.7",
            collectionId: collection.id,
            bottleId: input.bottle,
            deletedCount: deleted.length,
          },
        });
      }

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
