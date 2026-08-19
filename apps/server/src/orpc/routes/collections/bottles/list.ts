import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottles,
  bottlesToDistillers,
  collectionBottles,
} from "@peated/server/db/schema";
import { getUserFromId, profileVisible } from "@peated/server/lib/api";
import {
  getReservedCollection,
  isReservedCollectionSlug,
  reservedCollectionSlugs,
} from "@peated/server/lib/db";
import { plainTextSearchQuery } from "@peated/server/lib/search";
import { procedure } from "@peated/server/orpc";
import {
  CollectionBottleSchema,
  CollectionBottleStatusSchema,
  listResponse,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { CollectionBottleSerializer } from "@peated/server/serializers/collectionBottle";
import type { SQL } from "drizzle-orm";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
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
        bottle: z.number().int().positive().optional(),
        status: z
          .union([CollectionBottleStatusSchema, z.literal("unset")])
          .optional(),
        cursor: z.coerce.number().gte(1).default(1),
        limit: z.coerce.number().gte(1).lte(100).default(25),
      })
      .strict(),
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
    if (input.query) {
      baseWhere.push(
        sql`EXISTS(
          SELECT FROM ${bottleAliases}
          WHERE ${bottleAliases.bottleId} = ${collectionBottles.bottleId}
            AND LOWER(${bottleAliases.name}) = ${input.query.toLowerCase()}
        ) OR ${bottles.searchVector} @@ ${plainTextSearchQuery(input.query)}`,
      );
    }
    if (input.brand) {
      baseWhere.push(eq(bottles.brandId, input.brand));
    }
    if (input.distiller) {
      baseWhere.push(sql`EXISTS(
        SELECT FROM ${bottlesToDistillers}
        WHERE ${bottlesToDistillers.distillerId} = ${input.distiller}
          AND ${bottlesToDistillers.bottleId} = ${collectionBottles.bottleId}
      )`);
    }
    if (input.bottle !== undefined) {
      baseWhere.push(eq(collectionBottles.bottleId, input.bottle));
    }
    if (input.status === "unset") {
      baseWhere.push(isNull(collectionBottles.status));
    } else if (input.status) {
      baseWhere.push(eq(collectionBottles.status, input.status));
    }

    const results = await db
      .select({ collectionBottles })
      .from(collectionBottles)
      .leftJoin(bottles, eq(bottles.id, collectionBottles.bottleId))
      .where(and(...baseWhere))
      .limit(limit + 1)
      .offset(offset)
      .orderBy(asc(bottles.fullName), asc(collectionBottles.id));

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
