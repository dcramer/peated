import { db } from "@peated/server/db";
import {
  collectionBottles,
  collections,
  users,
} from "@peated/server/db/schema";
import {
  composeActivity,
  countPrimaryActivity,
  encodeActivityCursor,
  getActivitySourceWindow,
  getPrimaryActivity,
  parseActivityCursor,
  serializeCollectionAddEntries,
  serializePrimaryActivityEntries,
  type CollectionAddGroup,
} from "@peated/server/lib/activityFeed";
import { getUserFromId, profileVisible } from "@peated/server/lib/api";
import { implement } from "@peated/server/orpc";
import userActivityListContract from "@peated/server/orpc/contracts/users/activity/list";
import { and, desc, eq, lte, sql } from "drizzle-orm";

type CollectionAddGroupRow = {
  collection: typeof collections.$inferSelect;
  windowStart: string;
  windowEnd: string;
  totalItems: string;
};

export default implement(userActivityListContract).handler(async function ({
  input,
  context,
  errors,
}) {
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

  const activityCursor = input.cursor
    ? parseActivityCursor(input.cursor)!
    : { page: 1, snapshotAt: new Date() };
  const userCondition = eq(users.id, user.id);
  const collectionBucket = sql<Date>`DATE_TRUNC('day', ${collectionBottles.createdAt})`;
  const collectionGroupCreatedAt = sql<Date>`MAX(${collectionBottles.createdAt})`;
  const [totalPrimary, secondaryCountResult] = await Promise.all([
    countPrimaryActivity({
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
            AND ${collections.createdById} = ${user.id}
          WHERE ${collectionBottles.createdAt} <= ${activityCursor.snapshotAt}
          GROUP BY ${collections.id}, DATE_TRUNC('day', ${collectionBottles.createdAt})
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

  const [primaryRows, collectionGroupRows] = await Promise.all([
    getPrimaryActivity({
      userCondition,
      snapshotAt: activityCursor.snapshotAt,
      limit: sourceWindow.primaryLimit,
      offset: sourceWindow.primaryOffset,
    }),
    db
      .select({
        collection: collections,
        windowStart: sql<string>`MIN(${collectionBottles.createdAt})::text`,
        windowEnd: sql<string>`MAX(${collectionBottles.createdAt})::text`,
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
      .where(lte(collectionBottles.createdAt, activityCursor.snapshotAt))
      .groupBy(collections.id, collectionBucket)
      .orderBy(desc(collectionGroupCreatedAt))
      .limit(sourceWindow.secondaryLimit)
      .offset(sourceWindow.secondaryOffset),
  ]);

  const primaryEntries = await serializePrimaryActivityEntries(
    primaryRows,
    context.user,
  );
  const secondaryEntries = await serializeCollectionAddEntries({
    groups: collectionGroupRows.map(
      (row: CollectionAddGroupRow): CollectionAddGroup => ({
        collection: row.collection,
        user,
        windowStart: row.windowStart,
        windowEnd: row.windowEnd,
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
