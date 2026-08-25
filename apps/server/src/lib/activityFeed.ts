import { db } from "@peated/server/db";
import type { Collection, Tasting, User } from "@peated/server/db/schema";
import { collectionBottles, tastings, users } from "@peated/server/db/schema";
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
import { and, desc, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";

export const COLLECTION_PREVIEW_LIMIT = 4;
export const SECONDARY_ENTRY_LIMIT_WITH_PRIMARY = 2;
export const TASTING_SESSION_INACTIVITY_HOURS = 3;

export type ActivityCursor = {
  page: number;
  snapshotAt: Date;
};

export type TastingSessionGroup = {
  id: number;
  createdById: number;
  startedAt: Date;
  lastActivityAt: Date;
  tastings: Tasting[];
};

export type CollectionAddGroup = {
  collection: Collection;
  user: User;
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

export interface ComposedActivity {
  results: ActivityEntry[];
  hasNext: boolean;
}

export function encodeActivityCursor({ page, snapshotAt }: ActivityCursor) {
  return `${page}:${snapshotAt.getTime()}`;
}

export function parseActivityCursor(value: string): ActivityCursor | null {
  const match = /^(\d+):(\d+)$/.exec(value);
  if (!match) return null;

  const page = Number(match[1]);
  const timestamp = Number(match[2]);
  const snapshotAt = new Date(timestamp);
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !Number.isSafeInteger(timestamp) ||
    Number.isNaN(snapshotAt.getTime())
  ) {
    return null;
  }

  return { page, snapshotAt };
}

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
}): ComposedActivity {
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

function markedTastingsSql({
  userCondition,
  snapshotAt,
}: {
  userCondition: SQL<unknown>;
  snapshotAt: Date;
}) {
  return sql`
    SELECT
      ordered_tastings.id,
      ordered_tastings.created_by_id,
      ordered_tastings.created_at,
      CASE
        WHEN ordered_tastings.previous_created_at IS NULL
          OR ordered_tastings.created_at - ordered_tastings.previous_created_at
            > (${TASTING_SESSION_INACTIVITY_HOURS} * INTERVAL '1 hour')
        THEN 1
        ELSE 0
      END AS is_session_start
    FROM (
      SELECT
        ${tastings.id} AS id,
        ${tastings.createdById} AS created_by_id,
        ${tastings.createdAt} AS created_at,
        LAG(${tastings.createdAt}) OVER (
          PARTITION BY ${tastings.createdById}
          ORDER BY ${tastings.createdAt}, ${tastings.id}
        ) AS previous_created_at
      FROM ${tastings}
      INNER JOIN ${users} ON ${users.id} = ${tastings.createdById}
      WHERE ${userCondition}
        AND ${lte(tastings.createdAt, snapshotAt)}
    ) ordered_tastings
  `;
}

/** Counts logical tasting sessions inside one stable activity snapshot. */
export async function countTastingSessions({
  userCondition,
  snapshotAt,
}: {
  userCondition: SQL<unknown>;
  snapshotAt: Date;
}) {
  const result = await db.execute<{ count: string }>(sql`
    SELECT COALESCE(SUM(marked_tastings.is_session_start), 0) AS count
    FROM (${markedTastingsSql({ userCondition, snapshotAt })}) marked_tastings
  `);
  return Number(result.rows[0]?.count ?? 0);
}

type TastingSessionRow = {
  session_id: string;
  created_by_id: string;
  started_at: Date | string;
  last_activity_at: Date | string;
  tasting_ids: (number | string)[];
};

/** Returns complete tasting sessions, so feed pagination never splits one. */
export async function getTastingSessions({
  userCondition,
  snapshotAt,
  offset,
  limit,
}: {
  userCondition: SQL<unknown>;
  snapshotAt: Date;
  offset: number;
  limit: number;
}): Promise<TastingSessionGroup[]> {
  if (!limit) return [];

  // Session membership and hydration must share one MVCC snapshot so a
  // concurrent deletion cannot leave an aggregate referencing a missing row.
  return await db.transaction(
    async (tx) => {
      const result = await tx.execute<TastingSessionRow>(sql`
        WITH marked_tastings AS (
          ${markedTastingsSql({ userCondition, snapshotAt })}
        ),
        numbered_tastings AS (
          SELECT
            marked_tastings.*,
            SUM(marked_tastings.is_session_start) OVER (
              PARTITION BY marked_tastings.created_by_id
              ORDER BY marked_tastings.created_at, marked_tastings.id
              ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
            ) AS session_number
          FROM marked_tastings
        ),
        tasting_sessions AS (
          SELECT
            MIN(numbered_tastings.id) AS session_id,
            numbered_tastings.created_by_id,
            MIN(numbered_tastings.created_at) AS started_at,
            MAX(numbered_tastings.created_at) AS last_activity_at,
            ARRAY_AGG(
              numbered_tastings.id
              ORDER BY numbered_tastings.created_at DESC, numbered_tastings.id DESC
            ) AS tasting_ids
          FROM numbered_tastings
          GROUP BY
            numbered_tastings.created_by_id,
            numbered_tastings.session_number
        )
        SELECT *
        FROM tasting_sessions
        ORDER BY tasting_sessions.last_activity_at DESC, tasting_sessions.session_id DESC
        OFFSET ${offset}
        LIMIT ${limit}
      `);

      const tastingIds = result.rows.flatMap((row) =>
        row.tasting_ids.map(Number),
      );
      const tastingRows = tastingIds.length
        ? await tx
            .select()
            .from(tastings)
            .where(inArray(tastings.id, tastingIds))
        : [];
      const tastingsById = new Map(
        tastingRows.map((tasting) => [tasting.id, tasting]),
      );

      return result.rows.map((row) => ({
        id: Number(row.session_id),
        createdById: Number(row.created_by_id),
        startedAt: coerceActivityDate(row.started_at),
        lastActivityAt: coerceActivityDate(row.last_activity_at),
        tastings: row.tasting_ids.map((id) => {
          const tasting = tastingsById.get(Number(id));
          if (!tasting) {
            throw new Error(
              `Activity session references missing Tasting ${id}.`,
            );
          }
          return tasting;
        }),
      }));
    },
    { accessMode: "read only", isolationLevel: "repeatable read" },
  );
}

/** Serializes logical tasting sessions into the shared activity contract. */
export async function serializeTastingSessionEntries(
  sessions: TastingSessionGroup[],
  currentUser?: User | null,
) {
  const tastingRows = sessions.flatMap((session) => session.tastings);
  const serializedTastings = await serialize(
    TastingSerializer,
    tastingRows,
    currentUser,
  );
  const serializedById = new Map(
    tastingRows.map((tasting, index) => [
      tasting.id,
      serializedTastings[index]!,
    ]),
  );

  return sessions.map((session): ActivityEntry => {
    const sessionTastings = session.tastings.map((tasting) => {
      const serialized = serializedById.get(tasting.id);
      if (!serialized) {
        throw new Error(
          `Activity session failed to serialize Tasting ${tasting.id}.`,
        );
      }
      return serialized;
    });
    const createdBy = sessionTastings[0]?.createdBy;
    if (!createdBy) {
      throw new Error(`Activity session ${session.id} has no tastings.`);
    }

    return {
      id: `tasting_session:${session.createdById}:${session.id}`,
      type: "tasting_session",
      priority: "primary",
      startedAt: session.startedAt.toISOString(),
      lastActivityAt: session.lastActivityAt.toISOString(),
      createdBy,
      tastings: sessionTastings,
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
      .select()
      .from(collectionBottles)
      .where(
        and(
          eq(collectionBottles.collectionId, group.collection.id),
          gte(collectionBottles.createdAt, group.windowStart),
          lte(collectionBottles.createdAt, group.windowEnd),
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
      items: await serialize(
        CollectionBottleSerializer,
        previewRows,
        currentUser,
      ),
      totalItems: group.totalItems,
    });
  }

  return entries;
}
