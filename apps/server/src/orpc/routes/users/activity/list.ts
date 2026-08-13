import { db } from "@peated/server/db";
import {
  collectionBottles,
  collections,
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
import { getUserFromId, profileVisible } from "@peated/server/lib/api";
import { procedure } from "@peated/server/orpc";
import { ActivityListResponseSchema } from "@peated/server/schemas";
import { and, desc, eq, lte, sql } from "drizzle-orm";
import { z } from "zod";

type CollectionAddGroupRow = {
  collection: typeof collections.$inferSelect;
  windowStart: Date | string;
  windowEnd: Date | string;
  totalItems: string;
};

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
      cursor: z
        .string()
        .max(64)
        .refine((value) => parseActivityCursor(value) !== null, {
          message: "Invalid activity cursor.",
        })
        .optional(),
      limit: z.coerce.number().gte(1).lte(100).default(10),
    }),
  )
  .output(ActivityListResponseSchema)
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

    const activityCursor = input.cursor
      ? parseActivityCursor(input.cursor)!
      : { page: 1, snapshotAt: new Date() };
    const userCondition = eq(users.id, user.id);
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
        .where(lte(collectionBottles.createdAt, activityCursor.snapshotAt))
        .groupBy(collections.id, collectionBucket)
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
          user,
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
