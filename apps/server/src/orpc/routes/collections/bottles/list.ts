import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottleReleases,
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
import { procedure } from "@peated/server/orpc";
import {
  CollectionBottleSchema,
  CollectionBottleStatusSchema,
  listResponse,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { CollectionBottleSerializer } from "@peated/server/serializers/collectionBottle";
import type { SQL } from "drizzle-orm";
import { and, asc, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { isLibraryCollection } from "./imageHelpers";

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
    z.object({
      collection: z.union([z.enum(reservedCollectionSlugs), z.coerce.number()]),
      user: z.union([z.literal("me"), z.string(), z.coerce.number()]),
      query: z.coerce.string().default(""),
      brand: z.coerce.number().nullish(),
      distiller: z.coerce.number().nullish(),
      bottle: z.coerce.number().optional(),
      release: z.coerce.number().optional(),
      baseOnly: z.coerce.boolean().optional(),
      status: z
        .union([CollectionBottleStatusSchema, z.literal("unset")])
        .optional(),
      cursor: z.coerce.number().gte(1).default(1),
      limit: z.coerce.number().gte(1).lte(100).default(25),
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

    const where: (SQL<unknown> | undefined)[] = [
      eq(collectionBottles.collectionId, collection.id),
    ];
    if (input.query) {
      // Match exact aliases alongside the bottle search vector for catalog parity.
      const exactAliasBottleIds = (
        await db
          .selectDistinct({ bottleId: bottleAliases.bottleId })
          .from(bottleAliases)
          .where(
            and(
              eq(sql`LOWER(${bottleAliases.name})`, input.query.toLowerCase()),
              isNotNull(bottleAliases.bottleId),
            ),
          )
      )
        .map((row) => row.bottleId)
        .filter((bottleId): bottleId is number => bottleId !== null);

      where.push(
        or(
          sql`${bottles.searchVector} @@ websearch_to_tsquery ('english', ${input.query})`,
          exactAliasBottleIds.length
            ? inArray(bottles.id, exactAliasBottleIds)
            : undefined,
        ),
      );
    }
    if (input.brand) {
      where.push(eq(bottles.brandId, input.brand));
    }
    if (input.distiller) {
      where.push(
        sql`EXISTS(SELECT FROM ${bottlesToDistillers} WHERE ${bottlesToDistillers.distillerId} = ${input.distiller} AND ${bottlesToDistillers.bottleId} = ${bottles.id})`,
      );
    }
    if (input.bottle) {
      where.push(eq(collectionBottles.bottleId, input.bottle));
    }
    if (input.baseOnly) {
      where.push(isNull(collectionBottles.releaseId));
    } else if (input.release) {
      where.push(eq(collectionBottles.releaseId, input.release));
    }
    if (input.status === "unset") {
      where.push(isNull(collectionBottles.status));
    } else if (input.status) {
      where.push(eq(collectionBottles.status, input.status));
    }

    const results = await db
      .select({ collectionBottles, bottle: bottles, release: bottleReleases })
      .from(collectionBottles)
      .where(where ? and(...where) : undefined)
      .innerJoin(bottles, eq(bottles.id, collectionBottles.bottleId))
      .leftJoin(
        bottleReleases,
        eq(bottleReleases.id, collectionBottles.releaseId),
      )
      .limit(limit + 1)
      .offset(offset)
      .orderBy(asc(bottles.fullName));

    return {
      results: await serialize(
        CollectionBottleSerializer,
        results
          .slice(0, limit)
          .map(({ collectionBottles, bottle, release }) => ({
            ...collectionBottles,
            release,
            bottle,
          })),
        context.user,
      ),
      rel: {
        nextCursor: results.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
