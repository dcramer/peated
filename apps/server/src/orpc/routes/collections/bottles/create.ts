import { RESERVED_COLLECTION_SLUGS } from "@peated/server/constants";
import { db } from "@peated/server/db";
import type { CollectionBottle } from "@peated/server/db/schema";
import { collectionBottles, collections } from "@peated/server/db/schema";
import { getUserFromId } from "@peated/server/lib/api";
import {
  getReservedCollection,
  isReservedCollectionSlug,
} from "@peated/server/lib/db";
import { logError } from "@peated/server/lib/log";
import { PendingUploadError } from "@peated/server/lib/pendingUploads";
import {
  ActiveBottleSelectionError,
  resolveActiveBottleIds,
} from "@peated/server/lib/resolveActiveBottleIds";
import { procedure } from "@peated/server/orpc";
import {
  requireAuth,
  requireTosAccepted,
} from "@peated/server/orpc/middleware";
import {
  CollectionBottleInputSchema,
  CollectionBottleSchema,
} from "@peated/server/schemas";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import {
  findCollectionBottleEntry,
  isLibraryCollection,
  serializeCollectionBottleEntry,
} from "./collectionBottleHelpers";
import {
  copyPendingImageForCollectionBottle,
  validatePendingImageForCollectionBottle,
} from "./imageHelpers";

const CollectionBottleCreateFields = {
  collection: z.union([z.enum(RESERVED_COLLECTION_SLUGS), z.coerce.number()]),
  pendingImageId: z.string().trim().min(1).optional(),
  user: z.union([z.literal("me"), z.coerce.number(), z.string()]),
} as const;

const CollectionBottleCreateInputSchema =
  CollectionBottleInputSchema.safeExtend(CollectionBottleCreateFields).strict();

export default procedure
  .use(requireAuth)
  .use(requireTosAccepted)
  .route({
    method: "POST",
    path: "/users/{user}/collections/{collection}/bottles",
    summary: "Add a Bottle to a collection",
    description:
      "Add one Bottle to a user's collection. Requires authentication and ownership.",
    operationId: "addBottleToCollection",
  })
  .input(CollectionBottleCreateInputSchema)
  .output(CollectionBottleSchema)
  .handler(async function ({ input, context, errors }) {
    const statusProvided = Object.hasOwn(input, "status");
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
            eq(collections.id, z.number().parse(input.collection)),
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
    if (statusProvided && !isLibraryCollection(collection)) {
      throw errors.BAD_REQUEST({
        message: "Bottle status is only supported for Library entries.",
      });
    }

    const collectionBottleResult = await db.transaction(async (tx) => {
      let bottleId: number;
      try {
        [bottleId] = await resolveActiveBottleIds(tx, [input.bottle]);
      } catch (error) {
        if (!(error instanceof ActiveBottleSelectionError)) throw error;
        if (error.reason === "missing") {
          throw errors.NOT_FOUND({
            message: "Cannot find bottle.",
            cause: error,
          });
        }
        throw errors.CONFLICT({
          message: "Bottle is not ready for collection activity.",
          cause: error,
        });
      }

      const findMembership = async () => {
        const memberships = await tx
          .select()
          .from(collectionBottles)
          .where(
            and(
              eq(collectionBottles.collectionId, collection.id),
              eq(collectionBottles.bottleId, bottleId),
            ),
          )
          .orderBy(asc(collectionBottles.id))
          .limit(2)
          .for("update");
        if (memberships.length > 1) {
          throw errors.CONFLICT({
            message: "Collection contains duplicate Bottle memberships.",
          });
        }
        return memberships[0];
      };

      const existingMembership = await findMembership();
      if (existingMembership) {
        return { collectionBottle: existingMembership, created: false };
      }

      const [createdCollectionBottle] = await tx
        .insert(collectionBottles)
        .values({
          collectionId: collection.id,
          bottleId,
          status: statusProvided ? (input.status ?? null) : null,
        })
        .onConflictDoNothing()
        .returning();

      let collectionBottle: CollectionBottle | undefined =
        createdCollectionBottle;
      if (!collectionBottle) {
        collectionBottle = await findMembership();
      } else {
        await tx
          .update(collections)
          .set({
            totalBottles: sql`${collections.totalBottles} + 1`,
          })
          .where(eq(collections.id, collection.id));
      }

      return collectionBottle
        ? { collectionBottle, created: Boolean(createdCollectionBottle) }
        : null;
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

        const update: Partial<typeof collectionBottles.$inferInsert> = {
          imageUrl,
        };
        if (statusProvided) update.status = input.status ?? null;
        const [updatedCollectionBottle] = await db
          .update(collectionBottles)
          .set(update)
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
    if (
      statusProvided &&
      !collectionBottleResult.created &&
      !input.pendingImageId
    ) {
      const [updatedCollectionBottle] = await db
        .update(collectionBottles)
        .set({ status: input.status ?? null })
        .where(eq(collectionBottles.id, collectionBottle.id))
        .returning();

      if (updatedCollectionBottle) {
        collectionBottle = updatedCollectionBottle;
      }
    }

    const result = await findCollectionBottleEntry({
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
