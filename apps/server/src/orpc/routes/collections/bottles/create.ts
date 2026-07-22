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
  CatalogTargetResolutionError,
  lockCatalogTargetAssignmentDescriptorInTransaction,
  resolveCatalogTargetForAssignment,
} from "@peated/server/lib/catalogTargets";
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
  CollectionBottleLegacyInputSchema,
  CollectionBottleSchema,
  CollectionBottleTargetInputSchema,
} from "@peated/server/schemas";
import { and, eq, isNull, sql } from "drizzle-orm";
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

const CollectionBottleCreateCommonInputSchema = z.object({
  collection: z.union([z.enum(reservedCollectionSlugs), z.coerce.number()]),
  pendingImageId: z.string().trim().min(1).optional(),
  user: z.union([z.literal("me"), z.coerce.number(), z.string()]),
});

const CollectionBottleCreateInputSchema = z.union([
  CollectionBottleCreateCommonInputSchema.extend(
    CollectionBottleTargetInputSchema.shape,
  ).strict(),
  CollectionBottleCreateCommonInputSchema.extend(
    CollectionBottleLegacyInputSchema.shape,
  ).strict(),
]);

export default procedure
  .use(requireAuth)
  .use(requireTosAccepted)
  .route({
    method: "POST",
    path: "/users/{user}/collections/{collection}/bottles",
    summary: "Add a CatalogTarget to a collection",
    description:
      "Add one authoritative exact-Bottle or generic-BottleGroup CatalogTarget to a user's collection. Staged retained Bottle/BottleRelease input is translated to that target. Requires authentication and ownership.",
    operationId: "addBottleToCollection",
    spec: (spec) => {
      const requestBody = spec.requestBody;
      if (!requestBody || "$ref" in requestBody) return spec;
      const json = requestBody.content?.["application/json"];
      const schema = json?.schema;
      if (
        !schema ||
        typeof schema === "boolean" ||
        "$ref" in schema ||
        schema.type !== "object"
      ) {
        return spec;
      }
      const properties = schema.properties ?? {};
      const oneOf: NonNullable<typeof schema.oneOf> = [
        {
          type: "object",
          properties: {
            pendingImageId: properties.pendingImageId,
            status: properties.status,
            target: properties.target,
          },
          required: ["target"],
          additionalProperties: false,
        },
        {
          type: "object",
          properties: {
            bottle: properties.bottle,
            pendingImageId: properties.pendingImageId,
            release: properties.release,
            status: properties.status,
          },
          required: ["bottle"],
          additionalProperties: false,
        },
      ];
      return {
        ...spec,
        requestBody: {
          ...requestBody,
          required: true,
          content: {
            ...requestBody.content,
            "application/json": {
              ...json,
              schema: { oneOf },
            },
          },
        },
      };
    },
  })
  .input(CollectionBottleCreateInputSchema)
  .output(CollectionBottleSchema)
  .handler(async function ({ input, context, errors }) {
    const identityInput =
      "bottle" in input
        ? {
            kind: "legacy" as const,
            bottleId: input.bottle,
            releaseId: input.release ?? null,
          }
        : { kind: "target" as const, targetId: input.target };
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

    if (identityInput.kind === "legacy") {
      const [bottle] = await db
        .select({ id: bottles.id })
        .from(bottles)
        .where(eq(bottles.id, identityInput.bottleId));
      if (!bottle) {
        throw errors.NOT_FOUND({
          message: "Cannot find bottle.",
        });
      }
    }

    if (identityInput.kind === "legacy" && identityInput.releaseId !== null) {
      const release = await db.query.bottleReleases.findFirst({
        where: and(
          eq(bottleReleases.id, identityInput.releaseId),
          eq(bottleReleases.bottleId, identityInput.bottleId),
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
    if (statusProvided && !isLibraryCollection(collection)) {
      throw errors.BAD_REQUEST({
        message: "Bottle status is only supported for Library entries.",
      });
    }

    const collectionBottleResult = await db
      .transaction(async (tx) => {
        // CatalogTarget must be locked before collection membership rows.
        const target = await resolveCatalogTargetForAssignment(
          identityInput.kind === "target"
            ? identityInput
            : {
                kind: "legacy",
                bottleId: identityInput.bottleId,
                releaseId: identityInput.releaseId,
                context: {
                  caller: "collections.bottles.create",
                  operation: "create",
                },
              },
          tx,
        );
        await lockCatalogTargetAssignmentDescriptorInTransaction(tx, target);
        const retainedBottleId =
          identityInput.kind === "target"
            ? target.bottleId
            : identityInput.bottleId;
        const retainedReleaseId =
          identityInput.kind === "target" ? null : identityInput.releaseId;

        const findTargetMembership = async () => {
          const [membership] = await tx
            .select()
            .from(collectionBottles)
            .where(
              and(
                eq(collectionBottles.collectionId, collection.id),
                eq(collectionBottles.targetId, target.targetId),
              ),
            )
            .limit(1)
            .for("update");
          return membership;
        };
        const findLegacyMembership = async () => {
          if (retainedBottleId === null) return undefined;
          const [membership] = await tx
            .select()
            .from(collectionBottles)
            .where(
              and(
                eq(collectionBottles.collectionId, collection.id),
                eq(collectionBottles.bottleId, retainedBottleId),
                retainedReleaseId !== null
                  ? eq(collectionBottles.releaseId, retainedReleaseId)
                  : isNull(collectionBottles.releaseId),
              ),
            )
            .limit(1)
            .for("update");
          return membership;
        };
        /**
         * Reconciles against an already locked descriptor. Its canonical target
         * wins, and only matching targetless retained state may be absorbed.
         */
        const reconcileExistingMembership = async () => {
          let targetMembership = await findTargetMembership();
          const legacyMembership = await findLegacyMembership();

          if (targetMembership) {
            if (
              legacyMembership &&
              legacyMembership.id !== targetMembership.id
            ) {
              if (legacyMembership.targetId !== null) {
                throw errors.CONFLICT({
                  message:
                    "Collection membership has a conflicting catalog target.",
                });
              }

              const imageUrl =
                (!targetMembership.imageUrl ||
                  targetMembership.imageUrl.trim() === "") &&
                legacyMembership.imageUrl &&
                legacyMembership.imageUrl.trim() !== ""
                  ? legacyMembership.imageUrl
                  : targetMembership.imageUrl;
              await tx
                .delete(collectionBottles)
                .where(eq(collectionBottles.id, legacyMembership.id));
              if (imageUrl !== targetMembership.imageUrl) {
                [targetMembership] = await tx
                  .update(collectionBottles)
                  .set({ imageUrl })
                  .where(eq(collectionBottles.id, targetMembership.id))
                  .returning();
              }
              await tx
                .update(collections)
                .set({
                  totalBottles: sql`${collections.totalBottles} - 1`,
                })
                .where(eq(collections.id, collection.id));
            }
            return targetMembership;
          }

          if (!legacyMembership) {
            return undefined;
          }
          if (
            legacyMembership.targetId !== null &&
            legacyMembership.targetId !== target.targetId
          ) {
            throw errors.CONFLICT({
              message:
                "Collection membership has a conflicting catalog target.",
            });
          }
          if (legacyMembership.targetId === null) {
            const [upgradedMembership] = await tx
              .update(collectionBottles)
              .set({ targetId: target.targetId })
              .where(eq(collectionBottles.id, legacyMembership.id))
              .returning();
            return upgradedMembership;
          }
          return legacyMembership;
        };

        const existingMembership = await reconcileExistingMembership();
        if (existingMembership) {
          return { collectionBottle: existingMembership, created: false };
        }

        const [createdCollectionBottle] = await tx
          .insert(collectionBottles)
          .values({
            collectionId: collection.id,
            bottleId: retainedBottleId,
            releaseId: retainedReleaseId,
            targetId: target.targetId,
            status: statusProvided ? (input.status ?? null) : null,
          })
          .onConflictDoNothing()
          .returning();

        let collectionBottle: CollectionBottle | undefined =
          createdCollectionBottle;
        if (collectionBottle) {
          await tx
            .update(collections)
            .set({
              totalBottles: sql`${collections.totalBottles} + 1`,
            })
            .where(eq(collections.id, collection.id));
          return { collectionBottle, created: true };
        } else {
          collectionBottle = await reconcileExistingMembership();
        }

        if (!collectionBottle) {
          return null;
        }

        return { collectionBottle, created: false };
      })
      .catch((error: unknown) => {
        if (
          identityInput.kind === "target" &&
          error instanceof CatalogTargetResolutionError
        ) {
          throw errors.BAD_REQUEST({
            message: "Cannot identify catalog target.",
            cause: error,
          });
        }
        throw error;
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
          .set({
            imageUrl,
            ...(statusProvided ? { status: input.status ?? null } : {}),
          })
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
