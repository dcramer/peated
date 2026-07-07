import { db } from "@peated/server/db";
import type {
  Bottle,
  BottleRelease,
  Collection,
  CollectionBottle,
  Tasting,
  User,
} from "@peated/server/db/schema";
import {
  bottleReleases,
  bottles,
  collectionBottles,
  collections,
  tastings,
} from "@peated/server/db/schema";
import { getUserFromId, profileVisible } from "@peated/server/lib/api";
import { getReservedCollection } from "@peated/server/lib/db";
import { procedure } from "@peated/server/orpc";
import {
  ProfileActivityEntrySchema,
  listResponse,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { CollectionSerializer } from "@peated/server/serializers/collection";
import { CollectionBottleSerializer } from "@peated/server/serializers/collectionBottle";
import { TastingSerializer } from "@peated/server/serializers/tasting";
import { UserSerializer } from "@peated/server/serializers/user";
import type { ProfileActivityEntry } from "@peated/server/types";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

// Profile activity is assembled at read time from authoritative tasting and
// collection tables. Tastings are primary activity; collection additions are
// grouped secondary activity and capped so they do not dominate the feed.
const COLLECTION_PREVIEW_LIMIT = 4;
const SECONDARY_ENTRY_LIMIT_WITH_PRIMARY = 2;

type CollectionBottleWithTarget = CollectionBottle & {
  bottle: Bottle;
  release: BottleRelease | null;
};

type CollectionAddSourceRow = {
  collectionBottle: CollectionBottle;
  bottle: Bottle;
  release: BottleRelease | null;
};

type CollectionAddGroup = {
  collection: Collection;
  bucket: Date | string;
  windowStart: Date;
  windowEnd: Date;
  totalItems: number;
};

type CollectionAddGroupRow = {
  collection: Collection;
  bucket: Date | string;
  windowStart: Date | string;
  windowEnd: Date | string;
  totalItems: string;
};

type ActivitySourceWindow = {
  primaryOffset: number;
  primaryLimit: number;
  secondaryOffset: number;
  secondaryLimit: number;
};

function coerceDate(value: Date | string) {
  return value instanceof Date ? value : new Date(`${value}+0000`);
}

/**
 * Returns per-source offsets for a logical feed page while keeping secondary
 * collection groups capped whenever primary tasting activity exists.
 */
function getActivitySourceWindow({
  cursor,
  limit,
  totalPrimary,
  totalSecondary,
}: {
  cursor: number;
  limit: number;
  totalPrimary: number;
  totalSecondary: number;
}): ActivitySourceWindow {
  const pageIndex = cursor - 1;

  if (limit === 1) {
    if (pageIndex < totalPrimary) {
      return {
        primaryOffset: pageIndex,
        primaryLimit: 1,
        secondaryOffset: 0,
        secondaryLimit: 0,
      };
    }

    return {
      primaryOffset: totalPrimary,
      primaryLimit: 0,
      secondaryOffset: pageIndex - totalPrimary,
      secondaryLimit: 1,
    };
  }

  if (!totalPrimary) {
    return {
      primaryOffset: 0,
      primaryLimit: 0,
      secondaryOffset: pageIndex * limit,
      secondaryLimit: limit,
    };
  }

  const secondaryPerPage = Math.min(
    SECONDARY_ENTRY_LIMIT_WITH_PRIMARY,
    limit - 1,
  );
  const primaryPerPageWithSecondary = limit - secondaryPerPage;
  const pagesWithSecondary = Math.ceil(totalSecondary / secondaryPerPage);
  const priorPagesWithSecondary = Math.min(pageIndex, pagesWithSecondary);
  const priorPagesWithoutSecondary = pageIndex - priorPagesWithSecondary;
  const pageSecondaryOffset =
    pageIndex < pagesWithSecondary
      ? pageIndex * secondaryPerPage
      : totalSecondary;
  const pageSecondaryLimit =
    pageIndex < pagesWithSecondary
      ? Math.min(secondaryPerPage, totalSecondary - pageSecondaryOffset)
      : 0;
  const primaryCapacity = limit - pageSecondaryLimit;

  return {
    primaryOffset:
      priorPagesWithSecondary * primaryPerPageWithSecondary +
      priorPagesWithoutSecondary * limit,
    primaryLimit: primaryCapacity,
    secondaryOffset: pageSecondaryOffset,
    secondaryLimit: pageSecondaryLimit,
  };
}

async function getCollectionHref(collection: Collection, user: User) {
  const [favoritesCollection, libraryCollection] = await Promise.all([
    getReservedCollection(db, user.id, "default"),
    getReservedCollection(db, user.id, "library"),
  ]);

  if (favoritesCollection?.id === collection.id) {
    return `/users/${user.username}/favorites`;
  }
  if (libraryCollection?.id === collection.id) {
    return `/users/${user.username}/library`;
  }
  return null;
}

function composeProfileActivity({
  primary,
  secondary,
  limit,
  sourceWindow,
  totalPrimary,
  totalSecondary,
}: {
  primary: ProfileActivityEntry[];
  secondary: ProfileActivityEntry[];
  limit: number;
  sourceWindow: ActivitySourceWindow;
  totalPrimary: number;
  totalSecondary: number;
}): { results: ProfileActivityEntry[]; hasNext: boolean } {
  if (limit === 1) {
    const result = primary.length ? [primary[0]] : secondary.slice(0, 1);
    return {
      results: result,
      hasNext:
        sourceWindow.primaryOffset + primary.length < totalPrimary ||
        sourceWindow.secondaryOffset + secondary.length < totalSecondary,
    };
  }

  const pageSecondary = secondary.slice(0, sourceWindow.secondaryLimit);
  const primaryCapacity = limit - pageSecondary.length;
  const pagePrimary = primary.slice(0, primaryCapacity);

  const result: ProfileActivityEntry[] = [];
  let secondaryIndex = 0;

  for (const primaryEntry of pagePrimary) {
    result.push(primaryEntry);
    if (secondaryIndex < pageSecondary.length) {
      result.push(pageSecondary[secondaryIndex]);
      secondaryIndex += 1;
    }
  }

  while (result.length < limit && secondaryIndex < pageSecondary.length) {
    result.push(pageSecondary[secondaryIndex]);
    secondaryIndex += 1;
  }

  return {
    results: result,
    hasNext:
      sourceWindow.primaryOffset + pagePrimary.length < totalPrimary ||
      sourceWindow.secondaryOffset + pageSecondary.length < totalSecondary,
  };
}

async function serializeTastingEntries(
  tastingRows: Tasting[],
  currentUser?: User | null,
) {
  const serializedTastings = await serialize(
    TastingSerializer,
    tastingRows,
    currentUser,
  );
  return tastingRows.map((tasting, index): ProfileActivityEntry => {
    return {
      id: `tasting:${tasting.id}`,
      type: "tasting",
      priority: "primary",
      createdAt: tasting.createdAt.toISOString(),
      tasting: serializedTastings[index],
    };
  });
}

async function serializeCollectionForActivity({
  collection,
  user,
  currentUser,
}: {
  collection: Collection;
  user: User;
  currentUser?: User | null;
}) {
  return {
    ...(await serialize(CollectionSerializer, collection, currentUser)),
    href: await getCollectionHref(collection, user),
  };
}

async function serializeCollectionBottlePreview(
  rows: CollectionAddSourceRow[],
  currentUser?: User | null,
) {
  return await serialize(
    CollectionBottleSerializer,
    rows.map(
      ({ collectionBottle, bottle, release }): CollectionBottleWithTarget => ({
        ...collectionBottle,
        bottle,
        release,
      }),
    ),
    currentUser,
  );
}

async function serializeCollectionAddEntries({
  groups,
  user,
  currentUser,
}: {
  groups: CollectionAddGroup[];
  user: User;
  currentUser?: User | null;
}) {
  const createdBy = await serialize(UserSerializer, user, currentUser);
  const serializedCollectionsById = new Map<
    number,
    Awaited<ReturnType<typeof serializeCollectionForActivity>>
  >();

  const entries: ProfileActivityEntry[] = [];
  for (const group of groups) {
    let collection = serializedCollectionsById.get(group.collection.id);
    if (!collection) {
      collection = await serializeCollectionForActivity({
        collection: group.collection,
        user,
        currentUser,
      });
      serializedCollectionsById.set(group.collection.id, collection);
    }

    const previewRows = await db
      .select({
        collectionBottle: collectionBottles,
        bottle: bottles,
        release: bottleReleases,
      })
      .from(collectionBottles)
      .innerJoin(bottles, eq(bottles.id, collectionBottles.bottleId))
      .leftJoin(
        bottleReleases,
        eq(bottleReleases.id, collectionBottles.releaseId),
      )
      .where(
        and(
          eq(collectionBottles.collectionId, group.collection.id),
          sql`DATE_TRUNC('day', ${collectionBottles.createdAt}) = ${group.bucket}::timestamp`,
        ),
      )
      .orderBy(desc(collectionBottles.createdAt))
      .limit(COLLECTION_PREVIEW_LIMIT);

    entries.push({
      id: `collection_add:${group.collection.id}:${group.windowEnd.getTime()}`,
      type: "collection_add",
      priority: "secondary",
      createdAt: group.windowEnd.toISOString(),
      windowStart: group.windowStart.toISOString(),
      windowEnd: group.windowEnd.toISOString(),
      createdBy,
      collection,
      items: await serializeCollectionBottlePreview(previewRows, currentUser),
      totalItems: group.totalItems,
    });
  }

  return entries;
}

export default procedure
  .route({
    method: "GET",
    path: "/users/{user}/activity",
    summary: "List profile activity",
    description:
      "Retrieve a user's profile activity feed with tastings and grouped collection additions",
    operationId: "listUserActivity",
  })
  .input(
    z.object({
      user: z.union([z.literal("me"), z.string(), z.coerce.number()]),
      cursor: z.coerce.number().gte(1).default(1),
      limit: z.coerce.number().gte(1).lte(100).default(10),
    }),
  )
  .output(listResponse(ProfileActivityEntrySchema))
  .handler(async function ({ input, context, errors }) {
    const user = await getUserFromId(db, input.user, context.user);
    if (!user) {
      if (input.user === "me") {
        throw errors.UNAUTHORIZED();
      }
      throw errors.NOT_FOUND({
        message: "User not found.",
      });
    }

    if (!(await profileVisible(db, user, context.user))) {
      throw errors.BAD_REQUEST({
        message: "User's profile is private.",
      });
    }

    const collectionBucket = sql<Date>`DATE_TRUNC('day', ${collectionBottles.createdAt})`;
    const collectionGroupCreatedAt = sql<Date>`MAX(${collectionBottles.createdAt})`;
    const [primaryCountRows, secondaryCountResult] = await Promise.all([
      db
        .select({
          count: sql<string>`COUNT(${tastings.id})`,
        })
        .from(tastings)
        .where(eq(tastings.createdById, user.id)),
      db.execute<{ count: string }>(sql`
        SELECT COUNT(*) as count
        FROM (
          SELECT 1
          FROM ${collectionBottles}
          INNER JOIN ${collections}
            ON ${collections.id} = ${collectionBottles.collectionId}
            AND ${collections.createdById} = ${user.id}
          GROUP BY ${collections.id}, DATE_TRUNC('day', ${collectionBottles.createdAt})
        ) activity_groups
      `),
    ]);
    const totalPrimary = Number(primaryCountRows[0]?.count ?? 0);
    const totalSecondary = Number(secondaryCountResult.rows[0]?.count ?? 0);
    const sourceWindow = getActivitySourceWindow({
      cursor: input.cursor,
      limit: input.limit,
      totalPrimary,
      totalSecondary,
    });

    const [tastingRows, collectionGroupRows] = await Promise.all([
      db
        .select()
        .from(tastings)
        .where(eq(tastings.createdById, user.id))
        .orderBy(desc(tastings.createdAt))
        .limit(sourceWindow.primaryLimit)
        .offset(sourceWindow.primaryOffset),
      db
        .select({
          collection: collections,
          bucket: collectionBucket,
          windowStart: sql<Date>`MIN(${collectionBottles.createdAt})`,
          windowEnd: sql<Date>`MAX(${collectionBottles.createdAt})`,
          totalItems: sql<string>`COUNT(${collectionBottles.id})`,
        })
        .from(collectionBottles)
        .innerJoin(
          collections,
          and(
            eq(collections.id, collectionBottles.collectionId),
            eq(collections.createdById, user.id),
          ),
        )
        .groupBy(collections.id, collectionBucket)
        .orderBy(desc(collectionGroupCreatedAt))
        .limit(sourceWindow.secondaryLimit)
        .offset(sourceWindow.secondaryOffset),
    ]);

    const primaryEntries = await serializeTastingEntries(
      tastingRows,
      context.user,
    );
    const secondaryEntries = await serializeCollectionAddEntries({
      groups: collectionGroupRows.map(
        (row: CollectionAddGroupRow): CollectionAddGroup => ({
          collection: row.collection,
          bucket: row.bucket,
          windowStart: coerceDate(row.windowStart),
          windowEnd: coerceDate(row.windowEnd),
          totalItems: Number(row.totalItems),
        }),
      ),
      user,
      currentUser: context.user,
    });

    const activity = composeProfileActivity({
      primary: primaryEntries,
      secondary: secondaryEntries,
      limit: input.limit,
      sourceWindow,
      totalPrimary,
      totalSecondary,
    });

    return {
      results: activity.results,
      rel: {
        nextCursor: activity.hasNext ? input.cursor + 1 : null,
        prevCursor: input.cursor > 1 ? input.cursor - 1 : null,
      },
    };
  });
