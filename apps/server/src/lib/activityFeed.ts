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
} from "@peated/server/db/schema";
import { getReservedCollection } from "@peated/server/lib/db";
import { serialize } from "@peated/server/serializers";
import { CollectionSerializer } from "@peated/server/serializers/collection";
import { CollectionBottleSerializer } from "@peated/server/serializers/collectionBottle";
import { TastingSerializer } from "@peated/server/serializers/tasting";
import { UserSerializer } from "@peated/server/serializers/user";
import type {
  ActivityCollectionAddEntry,
  ActivityEntry,
} from "@peated/server/types";
import { and, desc, eq, sql } from "drizzle-orm";

export const COLLECTION_PREVIEW_LIMIT = 4;
export const SECONDARY_ENTRY_LIMIT_WITH_PRIMARY = 2;

type CollectionBottleWithTarget = CollectionBottle & {
  bottle: Bottle;
  release: BottleRelease | null;
};

type CollectionAddSourceRow = {
  collectionBottle: CollectionBottle;
  bottle: Bottle;
  release: BottleRelease | null;
};

export type CollectionAddGroup = {
  collection: Collection;
  user: User;
  bucket: Date | string;
  windowStart: Date;
  windowEnd: Date;
  totalItems: number;
};

export type ActivitySourceWindow = {
  primaryOffset: number;
  primaryLimit: number;
  secondaryOffset: number;
  secondaryLimit: number;
};

/** Coerces database date bucket values into UTC activity timestamps. */
export function coerceActivityDate(value: Date | string) {
  return value instanceof Date ? value : new Date(`${value}+0000`);
}

/**
 * Returns per-source offsets for a logical feed page while keeping secondary
 * collection groups capped whenever primary tasting activity exists.
 */
export function getActivitySourceWindow({
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

/** Interleaves primary tastings with capped secondary collection activity. */
export function composeActivity({
  primary,
  secondary,
  limit,
  sourceWindow,
  totalPrimary,
  totalSecondary,
}: {
  primary: ActivityEntry[];
  secondary: ActivityEntry[];
  limit: number;
  sourceWindow: ActivitySourceWindow;
  totalPrimary: number;
  totalSecondary: number;
}): { results: ActivityEntry[]; hasNext: boolean } {
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

  const result: ActivityEntry[] = [];
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

/** Wraps serialized tastings in the shared activity-entry contract. */
export async function serializeTastingEntries(
  tastingRows: Tasting[],
  currentUser?: User | null,
) {
  const serializedTastings = await serialize(
    TastingSerializer,
    tastingRows,
    currentUser,
  );
  return tastingRows.map((tasting, index): ActivityEntry => {
    return {
      id: `tasting:${tasting.id}`,
      type: "tasting",
      priority: "primary",
      createdAt: tasting.createdAt.toISOString(),
      tasting: serializedTastings[index],
    };
  });
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

/** Serializes grouped collection additions with actor, destination, and previews. */
export async function serializeCollectionAddEntries({
  groups,
  currentUser,
}: {
  groups: CollectionAddGroup[];
  currentUser?: User | null;
}) {
  const serializedUsersById = new Map<
    number,
    ActivityCollectionAddEntry["createdBy"]
  >();
  const serializedCollectionsById = new Map<
    number,
    Awaited<ReturnType<typeof serializeCollectionForActivity>>
  >();

  const entries: ActivityEntry[] = [];
  for (const group of groups) {
    let createdBy = serializedUsersById.get(group.user.id);
    if (!createdBy) {
      createdBy = await serialize(UserSerializer, group.user, currentUser);
      serializedUsersById.set(group.user.id, createdBy);
    }

    let collection = serializedCollectionsById.get(group.collection.id);
    if (!collection) {
      collection = await serializeCollectionForActivity({
        collection: group.collection,
        user: group.user,
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
      id: `collection_add:${group.user.id}:${group.collection.id}:${group.windowEnd.getTime()}`,
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
