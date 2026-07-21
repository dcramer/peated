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
import {
  CollectionBottleLegacyInputSchema,
  CollectionBottleTargetInputSchema,
} from "@peated/server/schemas";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";

const CollectionBottleDeleteCommonInputSchema = z.object({
  collection: z.union([z.enum(reservedCollectionSlugs), z.coerce.number()]),
  user: z.union([z.literal("me"), z.coerce.number(), z.string()]),
});

const CollectionBottleDeleteInputSchema = z.union([
  CollectionBottleDeleteCommonInputSchema.extend(
    CollectionBottleTargetInputSchema.shape,
  ).strict(),
  CollectionBottleDeleteCommonInputSchema.extend({
    ...CollectionBottleLegacyInputSchema.shape,
    baseOnly: z.coerce.boolean().optional(),
  }).strict(),
]);

export default procedure
  .use(requireAuth)
  .use(requireTosAccepted)
  .route({
    method: "DELETE",
    path: "/users/{user}/collections/{collection}/bottles",
    summary: "Remove a CatalogTarget from a collection",
    description:
      "Remove one authoritative CatalogTarget membership from a user's collection. Staged retained Bottle/BottleRelease and base-only inputs are translated to a target; the legacy Bottle-only shape temporarily retains family-wide deletion semantics. Requires authentication and ownership.",
    operationId: "removeBottleFromCollection",
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
            status: properties.status,
            target: properties.target,
          },
          required: ["target"],
          additionalProperties: false,
        },
        {
          type: "object",
          properties: {
            baseOnly: properties.baseOnly,
            bottle: properties.bottle,
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
      const hasTargetIntent = "target" in input;
      const targetId = hasTargetIntent ? input.target : undefined;
      const baseOnly = "baseOnly" in input ? input.baseOnly : undefined;
      const retainedBottleId = "bottle" in input ? input.bottle : undefined;
      const specificReleaseId =
        !baseOnly && "release" in input ? (input.release ?? null) : null;
      const hasSpecificIntent =
        hasTargetIntent || baseOnly || specificReleaseId !== null;
      let target = null;
      if (hasSpecificIntent) {
        // CatalogTarget must be locked before collection membership rows.
        try {
          target = await resolveCatalogTargetForAssignment(
            hasTargetIntent
              ? { kind: "target", targetId: input.target }
              : {
                  kind: "legacy",
                  bottleId: retainedBottleId!,
                  releaseId: specificReleaseId,
                  context: {
                    caller: "collections.bottles.delete",
                    operation: baseOnly ? "deleteBase" : "deleteRelease",
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

      const targetlessPair =
        hasTargetIntent || retainedBottleId === undefined
          ? sql`false`
          : and(
              isNull(collectionBottles.targetId),
              eq(collectionBottles.bottleId, retainedBottleId),
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
              : eq(collectionBottles.bottleId, retainedBottleId!),
          ),
        )
        .returning();

      if (!hasSpecificIntent) {
        // This legacy family operation intentionally spans multiple retained
        // identities. Target-native removal bypasses it; task 9.7 removes it.
        logInfo("Legacy collection Bottle family compatibility write", {
          extra: {
            event: "collection_bottle.compatibility",
            caller: "collections.bottles.delete",
            operation: "deleteFamily",
            removalTask: "9.7",
            collectionId: collection.id,
            bottleId: retainedBottleId!,
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
