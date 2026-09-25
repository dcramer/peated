import { db } from "@peated/server/db";
import type {
  Bottle,
  Collection,
  ExternalReview,
  MemberReview,
  Tasting,
  User,
} from "@peated/server/db/schema";
import {
  bottles,
  collectionBottles,
  collections,
  externalReviewArticles,
  externalReviewPublications,
  externalReviews,
  memberReviews,
  tastings,
  users,
} from "@peated/server/db/schema";
import { visibleExternalReviewWhere } from "@peated/server/externalReviews/visibility";
import { getReservedCollectionsByUser, mapRows } from "@peated/server/lib/db";
import { serialize } from "@peated/server/serializers";
import { BottleSerializer } from "@peated/server/serializers/bottle";
import { CollectionSerializer } from "@peated/server/serializers/collection";
import { CollectionBottleSerializer } from "@peated/server/serializers/collectionBottle";
import { ExternalReviewSerializer } from "@peated/server/serializers/externalReview";
import { MemberReviewSerializer } from "@peated/server/serializers/memberReview";
import { TastingSerializer } from "@peated/server/serializers/tasting";
import { UserSerializer } from "@peated/server/serializers/user";
import type {
  ActivityCollectionAddEntry,
  ActivityEntry,
} from "@peated/server/types";
import { and, desc, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";
import { unionAll } from "drizzle-orm/pg-core";

export {
  encodeActivityCursor,
  parseActivityCursor,
  type ActivityCursor,
} from "./activityCursor";

export const COLLECTION_PREVIEW_LIMIT = 4;
// Activity feed rule: a collection-add session ends after six hours of inactivity.
export const COLLECTION_ADD_SESSION_INACTIVITY_HOURS = 6;
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
        AND ${tastings.removedAt} IS NULL
        AND ${tastings.createdAt} <= ${snapshotAt}
    ) ordered_tastings
  `;
}

function markedCollectionAdditionsSql({
  userCondition,
  snapshotAt,
}: {
  userCondition: SQL<unknown>;
  snapshotAt: Date;
}) {
  return sql`
    SELECT
      ordered_additions.id,
      ordered_additions.collection_id,
      ordered_additions.created_at,
      CASE
        WHEN ordered_additions.previous_created_at IS NULL
          OR ordered_additions.created_at - ordered_additions.previous_created_at
            > (${COLLECTION_ADD_SESSION_INACTIVITY_HOURS} * INTERVAL '1 hour')
        THEN 1
        ELSE 0
      END AS is_session_start
    FROM (
      SELECT
        ${collectionBottles.id} AS id,
        ${collectionBottles.collectionId} AS collection_id,
        ${collectionBottles.createdAt} AS created_at,
        LAG(${collectionBottles.createdAt}) OVER (
          PARTITION BY ${collectionBottles.collectionId}
          ORDER BY ${collectionBottles.createdAt}, ${collectionBottles.id}
        ) AS previous_created_at
      FROM ${collectionBottles}
      INNER JOIN ${collections}
        ON ${collections.id} = ${collectionBottles.collectionId}
      INNER JOIN ${users} ON ${users.id} = ${collections.createdById}
      WHERE ${userCondition}
        AND ${collectionBottles.createdAt} <= ${snapshotAt.toISOString()}::timestamp
    ) ordered_additions
  `;
}

function numberedCollectionAdditionsSql({
  userCondition,
  snapshotAt,
}: {
  userCondition: SQL<unknown>;
  snapshotAt: Date;
}) {
  return sql`
    SELECT
      marked_additions.*,
      SUM(marked_additions.is_session_start) OVER (
        PARTITION BY marked_additions.collection_id
        ORDER BY marked_additions.created_at, marked_additions.id
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) AS session_number
    FROM (
      ${markedCollectionAdditionsSql({ userCondition, snapshotAt })}
    ) marked_additions
  `;
}

/** Counts collection-add sessions inside one activity snapshot. */
export async function countCollectionAddGroups({
  userCondition,
  snapshotAt,
}: {
  userCondition: SQL<unknown>;
  snapshotAt: Date;
}) {
  const result = await db.execute<{ count: string }>(sql`
    SELECT COUNT(*) AS count
    FROM (
      SELECT 1
      FROM (
        ${numberedCollectionAdditionsSql({ userCondition, snapshotAt })}
      ) numbered_additions
      GROUP BY
        numbered_additions.collection_id,
        numbered_additions.session_number
    ) collection_add_groups
  `);
  return Number(result.rows[0]?.count ?? 0);
}

type CollectionAddGroupRow = {
  collection_id: number | string;
  window_start: string;
  window_end: string;
  total_items: string;
  collection: object;
  user: object;
};

/** Pages collection additions without splitting a six-hour activity session. */
export async function getCollectionAddGroups({
  userCondition,
  snapshotAt,
  offset,
  limit,
}: {
  userCondition: SQL<unknown>;
  snapshotAt: Date;
  offset: number;
  limit: number;
}): Promise<CollectionAddGroup[]> {
  if (!limit) return [];

  // One statement returns each group with its collection and owner, so the
  // page needs no transaction or second round trip and reads one snapshot.
  const result = await db.execute<CollectionAddGroupRow>(sql`
    SELECT
      numbered_additions.collection_id,
      MIN(numbered_additions.created_at)::text AS window_start,
      MAX(numbered_additions.created_at)::text AS window_end,
      COUNT(numbered_additions.id) AS total_items,
      to_jsonb(${collections}) AS collection,
      to_jsonb(${users}) AS "user"
    FROM (
      ${numberedCollectionAdditionsSql({ userCondition, snapshotAt })}
    ) numbered_additions
    INNER JOIN ${collections}
      ON ${collections.id} = numbered_additions.collection_id
    INNER JOIN ${users} ON ${users.id} = ${collections.createdById}
    GROUP BY
      numbered_additions.collection_id,
      numbered_additions.session_number,
      ${collections.id},
      ${users.id}
    ORDER BY window_end DESC, numbered_additions.collection_id DESC
    OFFSET ${offset}
    LIMIT ${limit}
  `);

  return result.rows.map(
    (row): CollectionAddGroup => ({
      collection: mapRows([row.collection], collections)[0]!,
      user: mapRows([row.user], users)[0]!,
      windowStart: row.window_start,
      windowEnd: row.window_end,
      totalItems: Number(row.total_items),
    }),
  );
}

/** Counts primary feed entries inside one activity snapshot. */
export async function countPrimaryActivity({
  includeCriticReviews = false,
  userCondition,
  snapshotAt,
}: {
  includeCriticReviews?: boolean;
  userCondition: SQL<unknown>;
  snapshotAt: Date;
}) {
  const criticReviewCount = includeCriticReviews
    ? sql` + (
        SELECT COUNT(*) FROM ${externalReviews}
        INNER JOIN ${externalReviewArticles}
          ON ${externalReviewArticles.id} = ${externalReviews.articleId}
        LEFT JOIN ${externalReviewPublications}
          ON ${externalReviewPublications.externalSiteId} = ${externalReviewArticles.externalSiteId}
        WHERE ${visibleExternalReviewWhere()}
          AND ${externalReviews.bottleId} IS NOT NULL
          AND ${externalReviews.createdAt} <= ${snapshotAt}
          AND ${externalReviewArticles.publishedAt} IS NOT NULL
          AND ${externalReviewArticles.publishedAt} <= ${snapshotAt}
      )`
    : sql``;
  const result = await db.execute<{ count: string }>(sql`
    SELECT (
      SELECT COALESCE(SUM(marked_tastings.is_session_start), 0)
      FROM (${markedTastingsSql({ userCondition, snapshotAt })}) marked_tastings
    ) + (
      SELECT COUNT(*) FROM ${memberReviews}
      INNER JOIN ${users} ON ${users.id} = ${memberReviews.createdById}
      WHERE ${userCondition} AND ${memberReviews.createdAt} <= ${snapshotAt}
        AND ${memberReviews.removedAt} IS NULL
    ) ${criticReviewCount} AS count
  `);
  return Number(result.rows[0]?.count ?? 0);
}

type PrimaryActivityRow = {
  type: "tasting_session" | "member_review" | "critic_review";
  id: string;
  created_by_id: string | null;
  started_at: Date | string;
  last_activity_at: Date | string;
  payload: object | object[] | null;
};

type PrimaryActivity =
  | (TastingSessionGroup & { type: "tasting_session" })
  | { type: "member_review"; review: MemberReview; bottle: Bottle }
  | { type: "critic_review"; review: ExternalReview };

/** Pages primary feed entries together, without splitting a tasting session. */
export async function getPrimaryActivity({
  includeCriticReviews = false,
  userCondition,
  snapshotAt,
  offset,
  limit,
}: {
  includeCriticReviews?: boolean;
  userCondition: SQL<unknown>;
  snapshotAt: Date;
  offset: number;
  limit: number;
}): Promise<PrimaryActivity[]> {
  if (!limit) return [];

  // One statement returns each entry with the rows it references, so session
  // membership and hydration share one snapshot and one round trip.
  const result = await db.execute<PrimaryActivityRow>(sql`
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
    SELECT
      primary_activity.type,
      primary_activity.id,
      primary_activity.created_by_id,
      primary_activity.started_at,
      primary_activity.last_activity_at,
      CASE primary_activity.type
        WHEN 'tasting_session' THEN (
          SELECT jsonb_agg(to_jsonb(${tastings}) ORDER BY ${tastings.createdAt} DESC, ${tastings.id} DESC)
          FROM ${tastings}
          WHERE ${tastings.id} = ANY(primary_activity.tasting_ids)
        )
        WHEN 'member_review' THEN (
          SELECT jsonb_build_object(
            'review', to_jsonb(${memberReviews}),
            'bottle', to_jsonb(${bottles})
          )
          FROM ${memberReviews}
          INNER JOIN ${bottles} ON ${bottles.id} = ${memberReviews.bottleId}
          WHERE ${memberReviews.id} = primary_activity.id
        )
        ELSE (
          SELECT to_jsonb(${externalReviews})
          FROM ${externalReviews}
          WHERE ${externalReviews.id} = primary_activity.id
        )
      END AS payload
    FROM (
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
        AND ${memberReviews.removedAt} IS NULL
      ${
        includeCriticReviews
          ? sql`
            UNION ALL
            SELECT 'critic_review' AS type, ${externalReviews.id} AS id,
              NULL::bigint AS created_by_id,
              ${externalReviewArticles.publishedAt} AS started_at,
              ${externalReviewArticles.publishedAt} AS last_activity_at,
              ARRAY[]::bigint[] AS tasting_ids
            FROM ${externalReviews}
            INNER JOIN ${externalReviewArticles}
              ON ${externalReviewArticles.id} = ${externalReviews.articleId}
            LEFT JOIN ${externalReviewPublications}
              ON ${externalReviewPublications.externalSiteId} = ${externalReviewArticles.externalSiteId}
            WHERE ${visibleExternalReviewWhere()}
              AND ${externalReviews.bottleId} IS NOT NULL
              AND ${externalReviews.createdAt} <= ${snapshotAt}
              AND ${externalReviewArticles.publishedAt} IS NOT NULL
              AND ${externalReviewArticles.publishedAt} <= ${snapshotAt}
          `
          : sql``
      }
    ) primary_activity
    ORDER BY last_activity_at DESC, id DESC, type
    OFFSET ${offset}
    LIMIT ${limit}
  `);

  return result.rows.map((row): PrimaryActivity => {
    if (row.type === "critic_review") {
      if (!row.payload) {
        throw new Error(
          `Activity references missing external review ${row.id}.`,
        );
      }
      return {
        type: "critic_review",
        review: mapRows([row.payload], externalReviews)[0]!,
      };
    }
    if (row.type === "member_review") {
      // SAFETY: the member_review branch above builds payload as
      // jsonb_build_object('review', ..., 'bottle', ...).
      const payload = row.payload as { review: object; bottle: object } | null;
      if (!payload) {
        throw new Error(`Activity references missing member review ${row.id}.`);
      }
      return {
        type: "member_review",
        review: mapRows([payload.review], memberReviews)[0]!,
        bottle: mapRows([payload.bottle], bottles)[0]!,
      };
    }
    const tastingRows = mapRows(
      Array.isArray(row.payload) ? row.payload : [],
      tastings,
    );
    if (!tastingRows.length) {
      throw new Error(`Activity session ${row.id} has no tastings.`);
    }
    return {
      type: "tasting_session",
      id: Number(row.id),
      createdById: Number(row.created_by_id!),
      startedAt: coerceActivityDate(row.started_at),
      lastActivityAt: coerceActivityDate(row.last_activity_at),
      tastings: tastingRows,
    };
  });
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

/** Serializes primary feed sources with their public API contracts. */
export async function serializePrimaryActivityEntries(
  items: PrimaryActivity[],
  currentUser?: User | null,
): Promise<ActivityEntry[]> {
  const sessions = items.filter((item) => item.type === "tasting_session");
  const reviews = items.filter((item) => item.type === "member_review");
  const criticReviews = items.filter((item) => item.type === "critic_review");
  const [
    sessionEntries,
    serializedReviews,
    serializedBottles,
    serializedCriticReviews,
  ] = await Promise.all([
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
    serialize(
      ExternalReviewSerializer,
      criticReviews.map((item) => item.review),
      currentUser,
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
  criticReviews.forEach((item, index) => {
    const review = serializedCriticReviews[index]!;
    const id = `critic_review:${review.id}`;
    entries.set(id, {
      id,
      type: "critic_review",
      priority: "primary",
      createdAt: review.article.publishedAt!,
      review,
    });
  });
  return items.map(
    (item) =>
      entries.get(
        item.type === "member_review"
          ? `member_review:${item.review.id}`
          : item.type === "critic_review"
            ? `critic_review:${item.review.id}`
            : `tasting_session:${item.createdById}:${item.id}`,
      )!,
  );
}

async function loadCollectionHrefs(groups: CollectionAddGroup[]) {
  const usersById = new Map(groups.map((group) => [group.user.id, group.user]));
  const reservedByUser = await getReservedCollectionsByUser(db, [
    ...usersById.keys(),
  ]);
  const hrefByCollectionId = new Map<number, string | null>();
  for (const user of usersById.values()) {
    const reserved = reservedByUser.get(user.id);
    if (reserved?.default) {
      hrefByCollectionId.set(
        reserved.default.id,
        `/users/${user.username}/favorites`,
      );
    }
    if (reserved?.library) {
      hrefByCollectionId.set(
        reserved.library.id,
        `/users/${user.username}/library`,
      );
    }
  }
  return hrefByCollectionId;
}

/** Loads the newest additions inside each group's exact database window. */
async function loadPreviewRows(groups: CollectionAddGroup[]) {
  // Activity previews must use exact database bounds; JS dates truncate microseconds.
  const selects = groups.map((group) =>
    db
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
      .limit(COLLECTION_PREVIEW_LIMIT),
  );
  const [first, second, ...rest] = selects;
  if (first === undefined) return [];
  if (second === undefined) return await first;
  return await unionAll(first, second, ...rest);
}

/** Serializes grouped collection additions with actor, destination, and previews. */
export async function serializeCollectionAddEntries({
  groups,
  currentUser,
}: {
  groups: CollectionAddGroup[];
  currentUser?: User | null;
}): Promise<ActivityEntry[]> {
  if (!groups.length) return [];
  const userList = [
    ...new Map(groups.map((g) => [g.user.id, g.user])).values(),
  ];
  const collectionList = [
    ...new Map(groups.map((g) => [g.collection.id, g.collection])).values(),
  ];

  // Every group on the page loads together: one user pass, one collection
  // pass, one preview pass, instead of a query chain per group.
  const [
    serializedUsers,
    serializedCollections,
    hrefByCollectionId,
    previewRows,
  ] = await Promise.all([
    serialize(UserSerializer, userList, currentUser),
    serialize(CollectionSerializer, collectionList, currentUser),
    loadCollectionHrefs(groups),
    loadPreviewRows(groups),
  ]);
  const serializedPreviews = await serialize(
    CollectionBottleSerializer,
    previewRows,
    currentUser,
  );
  const previewById = new Map(
    previewRows.map((row, index) => [row.id, serializedPreviews[index]!]),
  );
  const userById = new Map(
    userList.map((user, index) => [user.id, serializedUsers[index]!]),
  );
  const collectionById = new Map(
    collectionList.map((collection, index) => [
      collection.id,
      serializedCollections[index]!,
    ]),
  );

  return groups.map((group): ActivityEntry => {
    const windowStart = coerceActivityDate(group.windowStart);
    const windowEnd = coerceActivityDate(group.windowEnd);
    const items = previewRows
      .filter(
        (row) =>
          row.collectionId === group.collection.id &&
          row.createdAt >= windowStart &&
          row.createdAt <= windowEnd,
      )
      .sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id,
      )
      .slice(0, COLLECTION_PREVIEW_LIMIT)
      .map((row) => previewById.get(row.id)!);
    return {
      id: `collection_add:${group.user.id}:${group.collection.id}:${windowEnd.getTime()}`,
      type: "collection_add",
      priority: "secondary",
      createdAt: windowEnd.toISOString(),
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      createdBy: userById.get(group.user.id)!,
      collection: {
        ...collectionById.get(group.collection.id)!,
        href: hrefByCollectionId.get(group.collection.id) ?? null,
      },
      items,
      totalItems: group.totalItems,
    };
  });
}
