import { implement } from "@orpc/server";
import sentryMiddleware from "@peated/orpc/server/middleware";
import { db } from "@peated/server/db";
import {
  collectionBottles,
  collections,
  follows,
  users,
} from "@peated/server/db/schema";
import {
  coerceActivityDate,
  composeActivity,
  countTastingSessions,
  encodeActivityCursor,
  getActivitySourceWindow,
  getTastingSessions,
  parseActivityCursor,
  serializeCollectionAddEntries,
  serializeTastingSessionEntries,
  type CollectionAddGroup,
} from "@peated/server/lib/activityFeed";
import type { Context } from "@peated/server/orpc/context";
import activityListContract from "@peated/server/orpc/contracts/activity/list";
import type { SQL } from "drizzle-orm";
import { and, desc, eq, lte, or, sql } from "drizzle-orm";

// Main activity is read-time composition over authoritative source tables. The
// route owns visibility filtering; shared helpers own entry shaping/throttling.
// The local filter intentionally mirrors the existing global feed until product
// semantics define what local activity should mean.
type ActivityFilter = "global" | "friends" | "local";

type CollectionAddGroupRow = {
  collection: typeof collections.$inferSelect;
  user: typeof users.$inferSelect;
  windowStart: Date | string;
  windowEnd: Date | string;
  totalItems: string;
};

function visibleActivityUserCondition({
  filter,
  currentUserId,
}: {
  filter: ActivityFilter;
  currentUserId?: number;
}) {
  if (filter === "friends" && currentUserId) {
    return sql`${users.id} IN (
      SELECT ${follows.toUserId}
      FROM ${follows}
      WHERE ${follows.fromUserId} = ${currentUserId}
        AND ${follows.status} = 'following'
    )`;
  }

  const visibleUsers: SQL<unknown>[] = [eq(users.private, false)];
  if (currentUserId) {
    visibleUsers.push(
      eq(users.id, currentUserId),
      sql`${users.id} IN (
        SELECT ${follows.toUserId}
        FROM ${follows}
        WHERE ${follows.fromUserId} = ${currentUserId}
          AND ${follows.status} = 'following'
      )`,
    );
  }

  return or(...visibleUsers)!;
}

export default implement(activityListContract)
  .$context<Context>()
  .use(sentryMiddleware())
  .handler(async function ({ input, context, errors }) {
    if (input.filter === "friends" && !context.user) {
      throw errors.UNAUTHORIZED();
    }

    const userCondition = visibleActivityUserCondition({
      filter: input.filter,
      currentUserId: context.user?.id,
    });
    const activityCursor = input.cursor
      ? parseActivityCursor(input.cursor)!
      : { page: 1, snapshotAt: new Date() };
    const collectionBucket = sql<Date>`DATE_TRUNC('day', ${collectionBottles.createdAt})`;
    const collectionGroupCreatedAt = sql<Date>`MAX(${collectionBottles.createdAt})`;

    const [totalPrimary, secondaryCountResult] = await Promise.all([
      countTastingSessions({
        userCondition,
        snapshotAt: activityCursor.snapshotAt,
      }),
      db.execute<{ count: string }>(sql`
        SELECT COUNT(*) as count
        FROM (
          SELECT 1
          FROM ${collectionBottles}
          INNER JOIN ${collections}
            ON ${collections.id} = ${collectionBottles.collectionId}
          INNER JOIN ${users}
            ON ${users.id} = ${collections.createdById}
          WHERE ${userCondition}
            AND ${collectionBottles.createdAt} <= ${activityCursor.snapshotAt}
          GROUP BY ${users.id}, ${collections.id}, DATE_TRUNC('day', ${collectionBottles.createdAt})
        ) activity_groups
      `),
    ]);
    const totalSecondary = Number(secondaryCountResult.rows[0]?.count ?? 0);
    const sourceWindow = getActivitySourceWindow({
      cursor: activityCursor.page,
      limit: input.limit,
      totalPrimary,
      totalSecondary,
    });

    const [tastingRows, collectionGroupRows] = await Promise.all([
      getTastingSessions({
        userCondition,
        snapshotAt: activityCursor.snapshotAt,
        limit: sourceWindow.primaryLimit,
        offset: sourceWindow.primaryOffset,
      }),
      db
        .select({
          collection: collections,
          user: users,
          windowStart: sql<Date>`MIN(${collectionBottles.createdAt})`,
          windowEnd: sql<Date>`MAX(${collectionBottles.createdAt})`,
          totalItems: sql<string>`COUNT(${collectionBottles.id})`,
        })
        .from(collectionBottles)
        .innerJoin(
          collections,
          eq(collections.id, collectionBottles.collectionId),
        )
        .innerJoin(users, eq(users.id, collections.createdById))
        .where(
          and(
            userCondition,
            lte(collectionBottles.createdAt, activityCursor.snapshotAt),
          ),
        )
        .groupBy(users.id, collections.id, collectionBucket)
        .orderBy(desc(collectionGroupCreatedAt))
        .limit(sourceWindow.secondaryLimit)
        .offset(sourceWindow.secondaryOffset),
    ]);

    const primaryEntries = await serializeTastingSessionEntries(
      tastingRows,
      context.user,
    );
    const secondaryEntries = await serializeCollectionAddEntries({
      groups: collectionGroupRows.map(
        (row: CollectionAddGroupRow): CollectionAddGroup => ({
          collection: row.collection,
          user: row.user,
          windowStart: coerceActivityDate(row.windowStart),
          windowEnd: coerceActivityDate(row.windowEnd),
          totalItems: Number(row.totalItems),
        }),
      ),
      currentUser: context.user,
    });

    const activity = composeActivity({
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
        nextCursor: activity.hasNext
          ? encodeActivityCursor({
              page: activityCursor.page + 1,
              snapshotAt: activityCursor.snapshotAt,
            })
          : null,
        prevCursor:
          activityCursor.page > 1
            ? encodeActivityCursor({
                page: activityCursor.page - 1,
                snapshotAt: activityCursor.snapshotAt,
              })
            : null,
      },
    };
  });
