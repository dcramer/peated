import { db } from "@peated/server/db";
import type {
  Bottle,
  Collection,
  MemberReview,
  Tasting,
  User,
} from "@peated/server/db/schema";
import {
  bottles,
  collectionBottles,
  memberReviews,
  tastings,
  users,
} from "@peated/server/db/schema";
import { getReservedCollection } from "@peated/server/lib/db";
import { serialize } from "@peated/server/serializers";
import { BottleSerializer } from "@peated/server/serializers/bottle";
import { CollectionSerializer } from "@peated/server/serializers/collection";
import { CollectionBottleSerializer } from "@peated/server/serializers/collectionBottle";
import { MemberReviewSerializer } from "@peated/server/serializers/memberReview";
import { TastingSerializer } from "@peated/server/serializers/tasting";
import { UserSerializer } from "@peated/server/serializers/user";
import type {
  ActivityCollectionAddEntry,
  ActivityEntry,
} from "@peated/server/types";
import { and, desc, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";

export {
  encodeActivityCursor,
  parseActivityCursor,
  type ActivityCursor,
} from "./activityCursor";

export const COLLECTION_PREVIEW_LIMIT = 4;
export const SECONDARY_ENTRY_LIMIT_WITH_PRIMARY = 2;
export const TASTING_SESSION_INACTIVITY_HOURS = 3;

export type TastingSessionGroup = {
  id: number;
  createdById: number;
  startedAt: Date;
  lastActivityAt: Date;
  tastings: Tasting[];
};

/** Keeps PostgreSQL timestamp text so preview bounds retain microsecond precision. */
export type CollectionAddGroup = {
  collection: Collection;
  user: User;
  windowStart: string;
  windowEnd: string;
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

/** Coerces database date bucket values into UTC activity timestamps. */
export function coerceActivityDate(value: Date | string) {
  return value instanceof Date ? value : new Date(`${value}+0000`);
}

/**
 * Returns per-source offsets for a logical feed page while keeping secondary
 * collection groups capped whenever primary tasting or review activity exists.
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

/** Interleaves primary tastings and member reviews with capped secondary collection activity. */
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
        AND ${tastings.createdAt} <= ${snapshotAt}
    ) ordered_tastings
  `;
}

/** Counts tasting sessions and member reviews inside one activity snapshot. */
export async function countPrimaryActivity({
  userCondition,
  snapshotAt,
}: {
  userCondition: SQL<unknown>;
  snapshotAt: Date;
}) {
  const result = await db.execute<{ count: string }>(sql`
    SELECT (
      SELECT COALESCE(SUM(marked_tastings.is_session_start), 0)
      FROM (${markedTastingsSql({ userCondition, snapshotAt })}) marked_tastings
    ) + (
      SELECT COUNT(*) FROM ${memberReviews}
      INNER JOIN ${users} ON ${users.id} = ${memberReviews.createdById}
      WHERE ${userCondition} AND ${memberReviews.createdAt} <= ${snapshotAt}
    ) AS count
  `);
  return Number(result.rows[0]?.count ?? 0);
}

type PrimaryActivityRow = {
  type: "tasting_session" | "member_review";
  id: string;
  created_by_id: string;
  started_at: Date | string;
  last_activity_at: Date | string;
  tasting_ids: (number | string)[];
};

type PrimaryActivity =
  | (TastingSessionGroup & { type: "tasting_session" })
  | { type: "member_review"; review: MemberReview; bottle: Bottle };

/** Pages sessions and member reviews together, without splitting a session. */
export async function getPrimaryActivity({
  userCondition,
  snapshotAt,
  offset,
  limit,
}: {
  userCondition: SQL<unknown>;
  snapshotAt: Date;
  offset: number;
  limit: number;
}): Promise<PrimaryActivity[]> {
  if (!limit) return [];

  // Session membership and hydration must share one MVCC snapshot so a
  // concurrent deletion cannot leave an aggregate referencing a missing row.
  return await db.transaction(
    async (tx) => {
      const result = await tx.execute<PrimaryActivityRow>(sql`
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
        SELECT * FROM (
          SELECT 'tasting_session' AS type, session_id AS id, created_by_id,
            started_at, last_activity_at, tasting_ids
          FROM tasting_sessions
          UNION ALL
          SELECT 'member_review' AS type, ${memberReviews.id} AS id,
            ${memberReviews.createdById} AS created_by_id,
            ${memberReviews.createdAt} AS started_at,
            ${memberReviews.createdAt} AS last_activity_at,
            ARRAY[]::bigint[] AS tasting_ids
          FROM ${memberReviews}
          INNER JOIN ${users} ON ${users.id} = ${memberReviews.createdById}
          WHERE ${userCondition} AND ${memberReviews.createdAt} <= ${snapshotAt}
        ) primary_activity
        ORDER BY last_activity_at DESC, id DESC, type
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

      const reviewIds = result.rows
        .filter((row) => row.type === "member_review")
        .map((row) => Number(row.id));
      const reviewRows = reviewIds.length
        ? await tx
            .select({ review: memberReviews, bottle: bottles })
            .from(memberReviews)
            .innerJoin(bottles, eq(bottles.id, memberReviews.bottleId))
            .where(inArray(memberReviews.id, reviewIds))
        : [];
      const reviewsById = new Map(
        reviewRows.map((row) => [row.review.id, row]),
      );

      return result.rows.map((row): PrimaryActivity => {
        if (row.type === "member_review") {
          const review = reviewsById.get(Number(row.id));
          if (!review)
            throw new Error(
              `Activity references missing member review ${row.id}.`,
            );
          return { type: "member_review", ...review };
        }
        return {
          type: "tasting_session",
          id: Number(row.id),
          createdById: Number(row.created_by_id),
          startedAt: coerceActivityDate(row.started_at),
          lastActivityAt: coerceActivityDate(row.last_activity_at),
          tastings: row.tasting_ids.map((id) => {
            const tasting = tastingsById.get(Number(id));
            if (!tasting)
              throw new Error(
                `Activity session references missing Tasting ${id}.`,
              );
            return tasting;
          }),
        };
      });
    },
    { accessMode: "read only", isolationLevel: "repeatable read" },
  );
}

/** Serializes logical tasting sessions into the shared activity contract. */
async function serializeTastingSessionEntries(
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

/** Serializes both primary sources with the same bottle and member contracts. */
export async function serializePrimaryActivityEntries(
  items: PrimaryActivity[],
  currentUser?: User | null,
): Promise<ActivityEntry[]> {
  const sessions = items.filter((item) => item.type === "tasting_session");
  const reviews = items.filter((item) => item.type === "member_review");
  const [sessionEntries, serializedReviews, serializedBottles] =
    await Promise.all([
      serializeTastingSessionEntries(sessions, currentUser),
      serialize(
        MemberReviewSerializer,
        reviews.map((item) => item.review),
        currentUser,
      ),
      serialize(
        BottleSerializer,
        reviews.map((item) => item.bottle),
        currentUser,
        [],
        { includeGroupSummary: true },
      ),
    ]);
  const entries = new Map(sessionEntries.map((entry) => [entry.id, entry]));
  reviews.forEach((item, index) => {
    const review = serializedReviews[index]!;
    const id = `member_review:${review.id}`;
    entries.set(id, {
      id,
      type: "member_review",
      priority: "primary",
      createdAt: review.createdAt,
      createdBy: review.createdBy,
      review: { ...review, bottle: serializedBottles[index]! },
    });
  });
  return items.map(
    (item) =>
      entries.get(
        item.type === "member_review"
          ? `member_review:${item.review.id}`
          : `tasting_session:${item.createdById}:${item.id}`,
      )!,
  );
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

    // Activity previews must use exact database bounds; JS dates truncate microseconds.
    const previewRows = await db
      .select()
      .from(collectionBottles)
      .where(
        and(
          eq(collectionBottles.collectionId, group.collection.id),
          gte(
            collectionBottles.createdAt,
            sql`${group.windowStart}::timestamp`,
          ),
          lte(collectionBottles.createdAt, sql`${group.windowEnd}::timestamp`),
        ),
      )
      .orderBy(desc(collectionBottles.createdAt))
      .limit(COLLECTION_PREVIEW_LIMIT);

    const windowStart = coerceActivityDate(group.windowStart);
    const windowEnd = coerceActivityDate(group.windowEnd);
    entries.push({
      id: `collection_add:${group.user.id}:${group.collection.id}:${windowEnd.getTime()}`,
      type: "collection_add",
      priority: "secondary",
      createdAt: windowEnd.toISOString(),
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
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
