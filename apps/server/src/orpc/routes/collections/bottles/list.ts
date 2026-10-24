import { db } from "@peated/server/db";
import {
  bottleReferences,
  bottles,
  bottlesToDistillers,
  collectionBottles,
} from "@peated/server/db/schema";
import { statedAgeBucketWhere } from "@peated/server/lib/ageBuckets";
import { getUserFromId, profileVisible } from "@peated/server/lib/api";
import {
  getReservedCollection,
  isReservedCollectionSlug,
} from "@peated/server/lib/db";
import {
  bottleTextPredicate,
  textSearchQuery,
} from "@peated/server/lib/textSearch";
import { implement } from "@peated/server/orpc";
import collectionBottleListContract from "@peated/server/orpc/contracts/collections/bottles/list";
import { serialize } from "@peated/server/serializers";
import { CollectionBottleSerializer } from "@peated/server/serializers/collectionBottle";
import type { SQL } from "drizzle-orm";
import { and, asc, desc, eq, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { isLibraryCollection } from "./collectionBottleHelpers";

export default implement(collectionBottleListContract).handler(async function ({
  input,
  context,
  errors,
}) {
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
      input.entity ||
      input.age ||
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
            eq(collections.id, z.number().parse(input.collection)),
          ),
      });

  if (!collection) {
    if (reservedCollection) {
      return {
        results: [],
        total: 0,
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
    // Wrap the alternatives with or() so the collection filter above still
    // applies to both; a bare OR would leak matches from every collection.
    baseWhere.push(
      or(
        sql`EXISTS(
          SELECT FROM ${bottleReferences}
          WHERE ${bottleReferences.bottleId} = ${collectionBottles.bottleId}
            AND LOWER(${bottleReferences.name}) = ${input.query.toLowerCase()}
            AND ${bottleReferences.ignored} IS NOT TRUE
        )`,
        bottleTextPredicate(textSearchQuery(input.query, { prefix: true })),
      ),
    );
  }
  if (input.brand) {
    baseWhere.push(eq(bottles.brandId, input.brand));
  }
  if (input.entity) {
    baseWhere.push(
      or(
        eq(bottles.brandId, input.entity),
        eq(bottles.bottlerId, input.entity),
        sql`EXISTS(
          SELECT FROM ${bottlesToDistillers}
          WHERE ${bottlesToDistillers.distillerId} = ${input.entity}
            AND ${bottlesToDistillers.bottleId} = ${collectionBottles.bottleId}
        )`,
      ),
    );
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
  if (input.age) {
    baseWhere.push(statedAgeBucketWhere(input.age));
  }

  const results = await db
    .select({ collectionBottles })
    .from(collectionBottles)
    .leftJoin(bottles, eq(bottles.id, collectionBottles.bottleId))
    .where(and(...baseWhere))
    .limit(limit + 1)
    .offset(offset)
    .orderBy(
      ...(input.sort === "-created"
        ? [desc(collectionBottles.createdAt), desc(collectionBottles.id)]
        : [asc(bottles.fullName), asc(collectionBottles.id)]),
    );

  // A short page proves the total unless it is an empty page past the first,
  // so count only when the page cannot.
  const total =
    results.length <= limit && (results.length > 0 || offset === 0)
      ? offset + results.length
      : await db
          .select({ count: sql<string>`COUNT(*)` })
          .from(collectionBottles)
          .leftJoin(bottles, eq(bottles.id, collectionBottles.bottleId))
          .where(and(...baseWhere))
          .then(([row]) => Number(row?.count ?? 0));

  return {
    results: await serialize(
      CollectionBottleSerializer,
      results.slice(0, limit).map(({ collectionBottles }) => collectionBottles),
      context.user,
    ),
    total,
    rel: {
      nextCursor: results.length > limit ? cursor + 1 : null,
      prevCursor: cursor > 1 ? cursor - 1 : null,
    },
  };
});
