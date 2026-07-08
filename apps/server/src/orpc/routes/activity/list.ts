import { db } from "@peated/server/db";
import {
  collectionBottles,
  collections,
  follows,
  tastings,
  users,
} from "@peated/server/db/schema";
import {
  coerceActivityDate,
  composeActivity,
  getActivitySourceWindow,
  serializeCollectionAddEntries,
  serializeTastingEntries,
  type CollectionAddGroup,
} from "@peated/server/lib/activityFeed";
import { procedure } from "@peated/server/orpc";
import { ActivityEntrySchema, listResponse } from "@peated/server/schemas";
import type { SQL } from "drizzle-orm";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { z } from "zod";

// Main activity is read-time composition over authoritative source tables. The
// route owns visibility filtering; shared helpers own entry shaping/throttling.
// The local filter intentionally mirrors the existing global feed until product
// semantics define what local activity should mean.
type ActivityFilter = "global" | "friends" | "local";

type CollectionAddGroupRow = {
  collection: typeof collections.$inferSelect;
  user: typeof users.$inferSelect;
  bucket: Date | string;
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

  return or(...visibleUsers);
}

export default procedure
  .route({
    method: "GET",
    path: "/activity",
    summary: "List activity",
    description:
      "Retrieve mixed activity with tastings and grouped collection additions",
    operationId: "listActivity",
  })
  .input(
    z
      .object({
        filter: z.enum(["global", "friends", "local"]).default("global"),
        cursor: z.coerce.number().gte(1).default(1),
        limit: z.coerce.number().gte(1).lte(100).default(10),
      })
      .default({
        filter: "global",
        cursor: 1,
        limit: 10,
      }),
  )
  .output(listResponse(ActivityEntrySchema))
  .handler(async function ({ input, context, errors }) {
    if (input.filter === "friends" && !context.user) {
      throw errors.UNAUTHORIZED();
    }

    const userCondition = visibleActivityUserCondition({
      filter: input.filter,
      currentUserId: context.user?.id,
    });
    const collectionBucket = sql<Date>`DATE_TRUNC('day', ${collectionBottles.createdAt})`;
    const collectionGroupCreatedAt = sql<Date>`MAX(${collectionBottles.createdAt})`;

    const [primaryCountRows, secondaryCountResult] = await Promise.all([
      db
        .select({
          count: sql<string>`COUNT(${tastings.id})`,
        })
        .from(tastings)
        .innerJoin(users, eq(users.id, tastings.createdById))
        .where(userCondition),
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
          GROUP BY ${users.id}, ${collections.id}, DATE_TRUNC('day', ${collectionBottles.createdAt})
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
        .select({ tasting: tastings })
        .from(tastings)
        .innerJoin(users, eq(users.id, tastings.createdById))
        .where(userCondition)
        .orderBy(desc(tastings.createdAt))
        .limit(sourceWindow.primaryLimit)
        .offset(sourceWindow.primaryOffset),
      db
        .select({
          collection: collections,
          user: users,
          bucket: collectionBucket,
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
        .where(and(userCondition))
        .groupBy(users.id, collections.id, collectionBucket)
        .orderBy(desc(collectionGroupCreatedAt))
        .limit(sourceWindow.secondaryLimit)
        .offset(sourceWindow.secondaryOffset),
    ]);

    const primaryEntries = await serializeTastingEntries(
      tastingRows.map((row) => row.tasting),
      context.user,
    );
    const secondaryEntries = await serializeCollectionAddEntries({
      groups: collectionGroupRows.map(
        (row: CollectionAddGroupRow): CollectionAddGroup => ({
          collection: row.collection,
          user: row.user,
          bucket: row.bucket,
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
        nextCursor: activity.hasNext ? input.cursor + 1 : null,
        prevCursor: input.cursor > 1 ? input.cursor - 1 : null,
      },
    };
  });
