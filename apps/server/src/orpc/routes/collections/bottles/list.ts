import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottleGroupDistillers,
  bottleGroups,
  bottles,
  bottlesToDistillers,
  catalogTargets,
  collectionBottles,
} from "@peated/server/db/schema";
import { getUserFromId, profileVisible } from "@peated/server/lib/api";
import { recordCatalogTargetReadFilterParity } from "@peated/server/lib/catalogTargetReadParity";
import { resolveLegacyCatalogTargetFilterForRead } from "@peated/server/lib/catalogTargets";
import {
  getReservedCollection,
  isReservedCollectionSlug,
  reservedCollectionSlugs,
} from "@peated/server/lib/db";
import { logInfo } from "@peated/server/lib/log";
import { procedure } from "@peated/server/orpc";
import {
  CollectionBottleSchema,
  CollectionBottleStatusSchema,
  listResponse,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { CollectionBottleSerializer } from "@peated/server/serializers/collectionBottle";
import type { SQL } from "drizzle-orm";
import { and, asc, eq, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { isLibraryCollection } from "./collectionBottleHelpers";

export default procedure
  .route({
    method: "GET",
    path: "/users/{user}/collections/{collection}/bottles",
    summary: "List collection bottles",
    description:
      "Retrieve bottles in a user's collection with pagination support. Respects privacy settings",
    operationId: "listCollectionBottles",
  })
  .input(
    z
      .object({
        collection: z.union([
          z.enum(reservedCollectionSlugs),
          z.coerce.number(),
        ]),
        user: z.union([z.literal("me"), z.string(), z.coerce.number()]),
        query: z.coerce.string().default(""),
        brand: z.coerce.number().nullish(),
        distiller: z.coerce.number().nullish(),
        target: z.number().int().positive().optional(),
        bottle: z.number().optional(),
        release: z.number().optional(),
        baseOnly: z.coerce.boolean().optional(),
        status: z
          .union([CollectionBottleStatusSchema, z.literal("unset")])
          .optional(),
        cursor: z.coerce.number().gte(1).default(1),
        limit: z.coerce.number().gte(1).lte(100).default(25),
      })
      .superRefine((input, ctx) => {
        if (
          input.target !== undefined &&
          (input.bottle !== undefined ||
            input.release !== undefined ||
            input.baseOnly !== undefined)
        ) {
          ctx.addIssue({
            code: "custom",
            path: ["target"],
            message:
              "A CatalogTarget filter cannot be combined with retained Bottle filters.",
          });
        }
      }),
  )
  // TODO(response-envelope): use helper to enable later switch to { data, meta }
  .output(listResponse(CollectionBottleSchema))
  .handler(async function ({ input, context, errors }) {
    const { cursor, limit } = input;

    const user = await getUserFromId(db, input.user, context.user);
    if (!user) {
      throw errors.NOT_FOUND({
        message: "User not found.",
      });
    }

    if (!(await profileVisible(db, user, context.user))) {
      throw errors.BAD_REQUEST({
        message: "User's profile is private.",
      });
    }

    const reservedCollection = isReservedCollectionSlug(input.collection)
      ? input.collection
      : null;
    if (
      reservedCollection !== "library" &&
      (input.query ||
        input.brand ||
        input.distiller ||
        (reservedCollection && input.status))
    ) {
      throw errors.BAD_REQUEST({
        message: "Collection filters are only supported for Library.",
      });
    }
    const collection = reservedCollection
      ? await getReservedCollection(db, user.id, reservedCollection)
      : await db.query.collections.findFirst({
          where: (collections, { and, eq }) =>
            and(
              eq(collections.createdById, user.id),
              eq(collections.id, input.collection as number),
            ),
        });

    if (!collection) {
      if (reservedCollection) {
        return {
          results: [],
          rel: {
            nextCursor: null,
            prevCursor: null,
          },
        };
      }

      throw errors.NOT_FOUND({
        message: "Collection not found.",
      });
    }
    if (input.status && !isLibraryCollection(collection)) {
      throw errors.BAD_REQUEST({
        message: "Status filtering is only supported for Library.",
      });
    }

    const offset = (cursor - 1) * limit;

    const baseWhere: (SQL<unknown> | undefined)[] = [
      eq(collectionBottles.collectionId, collection.id),
    ];
    const targetWhere: SQL<unknown>[] = [];
    const parityFilters: {
      filter: "catalog_reference" | "entity" | "query";
      targetWhere: SQL<unknown>;
      legacyWhere: SQL<unknown>;
    }[] = [];
    if (input.query) {
      const authoritativeWhere = or(
        and(
          sql`${catalogTargets.bottleId} IS NOT NULL`,
          sql`${bottles.searchVector} @@ websearch_to_tsquery ('english', ${input.query})`,
        ),
        and(
          isNull(catalogTargets.bottleId),
          or(
            sql`${bottleGroups.fullName} ILIKE ${`%${input.query}%`}`,
            sql`${bottleGroups.name} ILIKE ${`%${input.query}%`}`,
          ),
        ),
        sql`EXISTS(
            SELECT FROM ${bottleAliases}
            WHERE ${bottleAliases.targetId} = ${collectionBottles.targetId}
              AND LOWER(${bottleAliases.name}) = ${input.query.toLowerCase()}
          )`,
      )!;
      const legacyWhere = or(
        sql`EXISTS(
          SELECT FROM ${bottles}
          WHERE ${bottles.id} = ${collectionBottles.bottleId}
            AND ${bottles.searchVector} @@ websearch_to_tsquery ('english', ${input.query})
        )`,
        sql`EXISTS(
          SELECT FROM ${bottleAliases}
          WHERE ${bottleAliases.bottleId} = ${collectionBottles.bottleId}
            AND LOWER(${bottleAliases.name}) = ${input.query.toLowerCase()}
        )`,
      )!;
      targetWhere.push(authoritativeWhere);
      parityFilters.push({
        filter: "query",
        targetWhere: authoritativeWhere,
        legacyWhere,
      });
    }
    if (input.brand) {
      const authoritativeWhere = or(
        and(
          sql`${catalogTargets.bottleId} IS NOT NULL`,
          eq(bottles.brandId, input.brand),
        ),
        and(
          isNull(catalogTargets.bottleId),
          eq(bottleGroups.brandId, input.brand),
        ),
      )!;
      const legacyWhere = sql`EXISTS(
        SELECT FROM ${bottles}
        WHERE ${bottles.id} = ${collectionBottles.bottleId}
          AND ${bottles.brandId} = ${input.brand}
      )`;
      targetWhere.push(authoritativeWhere);
      parityFilters.push({
        filter: "entity",
        targetWhere: authoritativeWhere,
        legacyWhere,
      });
    }
    if (input.distiller) {
      const authoritativeWhere = or(
        and(
          sql`${catalogTargets.bottleId} IS NOT NULL`,
          sql`EXISTS(
            SELECT FROM ${bottlesToDistillers}
            WHERE ${bottlesToDistillers.distillerId} = ${input.distiller}
              AND ${bottlesToDistillers.bottleId} = ${catalogTargets.bottleId}
          )`,
        ),
        and(
          isNull(catalogTargets.bottleId),
          sql`EXISTS(
            SELECT FROM ${bottleGroupDistillers}
            WHERE ${bottleGroupDistillers.distillerId} = ${input.distiller}
              AND ${bottleGroupDistillers.groupId} = ${catalogTargets.groupId}
          )`,
        ),
      )!;
      const legacyWhere = sql`EXISTS(
        SELECT FROM ${bottlesToDistillers}
        WHERE ${bottlesToDistillers.distillerId} = ${input.distiller}
          AND ${bottlesToDistillers.bottleId} = ${collectionBottles.bottleId}
      )`;
      targetWhere.push(authoritativeWhere);
      parityFilters.push({
        filter: "entity",
        targetWhere: authoritativeWhere,
        legacyWhere,
      });
    }
    if (input.target !== undefined) {
      targetWhere.push(eq(collectionBottles.targetId, input.target));
    } else if (input.bottle !== undefined || input.release !== undefined) {
      const target = await resolveLegacyCatalogTargetFilterForRead(
        {
          bottleId: input.bottle,
          releaseId: input.release,
        },
        { caller: "collections.bottles.list", operation: "filter" },
      );
      const familyWide =
        input.bottle !== undefined &&
        input.release === undefined &&
        !input.baseOnly;
      const authoritativeWhere = target
        ? familyWide
          ? eq(catalogTargets.groupId, target.groupId)
          : eq(collectionBottles.targetId, target.targetId)
        : sql`false`;
      const legacyWhere = and(
        input.bottle === undefined
          ? undefined
          : eq(collectionBottles.bottleId, input.bottle),
        input.release === undefined
          ? undefined
          : eq(collectionBottles.releaseId, input.release),
        input.baseOnly ? isNull(collectionBottles.releaseId) : undefined,
      )!;
      targetWhere.push(authoritativeWhere);
      parityFilters.push({
        filter: "catalog_reference",
        targetWhere: authoritativeWhere,
        legacyWhere,
      });
    } else if (input.baseOnly) {
      // Standalone baseOnly is retained query compatibility, not catalog
      // identity. Task 9.7 removes it with the legacy collection adapter.
      baseWhere.push(isNull(collectionBottles.releaseId));
      logInfo("Legacy collection standalone base-only compatibility read", {
        extra: {
          event: "collection_bottle.compatibility",
          caller: "collections.bottles.list",
          operation: "filterBaseOnly",
          removalTask: "9.7",
          collectionId: collection.id,
        },
      });
    }
    if (input.status === "unset") {
      baseWhere.push(isNull(collectionBottles.status));
    } else if (input.status) {
      baseWhere.push(eq(collectionBottles.status, input.status));
    }

    const results = await db
      .select({ collectionBottles })
      .from(collectionBottles)
      .leftJoin(
        catalogTargets,
        eq(catalogTargets.id, collectionBottles.targetId),
      )
      .leftJoin(bottles, eq(bottles.id, catalogTargets.bottleId))
      .leftJoin(bottleGroups, eq(bottleGroups.id, catalogTargets.groupId))
      .where(and(...baseWhere, ...targetWhere))
      .limit(limit + 1)
      .offset(offset)
      .orderBy(
        asc(sql`COALESCE(${bottles.fullName}, ${bottleGroups.fullName})`),
        asc(collectionBottles.id),
      );

    await Promise.all(
      parityFilters.map(async (parityFilter) => {
        const candidates = await db
          .select({
            id: collectionBottles.id,
            targetId: collectionBottles.targetId,
            bottleId: collectionBottles.bottleId,
            releaseId: collectionBottles.releaseId,
            targetMatches: sql<boolean>`COALESCE(${parityFilter.targetWhere}, false)`,
            legacyMatches: sql<boolean>`COALESCE(${parityFilter.legacyWhere}, false)`,
          })
          .from(collectionBottles)
          .leftJoin(
            catalogTargets,
            eq(catalogTargets.id, collectionBottles.targetId),
          )
          .leftJoin(bottles, eq(bottles.id, catalogTargets.bottleId))
          .leftJoin(bottleGroups, eq(bottleGroups.id, catalogTargets.groupId))
          .where(
            and(
              ...baseWhere,
              or(parityFilter.targetWhere, parityFilter.legacyWhere),
            ),
          )
          .limit(limit + 1)
          .offset(offset)
          .orderBy(
            asc(sql`COALESCE(${bottles.fullName}, ${bottleGroups.fullName})`),
            asc(collectionBottles.id),
          );

        recordCatalogTargetReadFilterParity(
          candidates.map((candidate) => ({
            consumerTable: "collection_bottle",
            rowLocator: { id: candidate.id },
            targetId: candidate.targetId,
            legacy: {
              bottleId: candidate.bottleId,
              releaseId: candidate.releaseId,
            },
            filter: parityFilter.filter,
            targetMatches: candidate.targetMatches,
            legacyMatches: candidate.legacyMatches,
          })),
          { caller: "collections.bottles.list", operation: "filter" },
        );
      }),
    );

    return {
      results: await serialize(
        CollectionBottleSerializer,
        results
          .slice(0, limit)
          .map(({ collectionBottles }) => collectionBottles),
        context.user,
      ),
      rel: {
        nextCursor: results.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
