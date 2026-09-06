import { follows, users } from "@peated/server/db/schema";
import {
  composeActivity,
  countCollectionAddGroups,
  countPrimaryActivity,
  encodeActivityCursor,
  getActivitySourceWindow,
  getCollectionAddGroups,
  getPrimaryActivity,
  parseActivityCursor,
  serializeCollectionAddEntries,
  serializePrimaryActivityEntries,
} from "@peated/server/lib/activityFeed";
import { viewerVisibleUserCondition } from "@peated/server/lib/activityVisibility";
import { implement } from "@peated/server/orpc";
import activityListContract from "@peated/server/orpc/contracts/activity/list";
import { sql } from "drizzle-orm";

// Main activity is read-time composition over authoritative source tables. The
// route owns visibility filtering; shared helpers own entry shaping/throttling.
// The local filter intentionally mirrors the existing global feed until product
// semantics define what local activity should mean.
type ActivityFilter = "global" | "friends" | "local";

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

  return viewerVisibleUserCondition(currentUserId);
}

export default implement(activityListContract).handler(async function ({
  input,
  context,
  errors,
}) {
  if (input.filter === "friends" && !context.user) {
    throw errors.UNAUTHORIZED();
  }

  const userCondition = visibleActivityUserCondition({
    filter: input.filter,
    currentUserId: context.user?.id,
  });
  const includeCriticReviews =
    input.includeCriticReviews && input.filter !== "friends";
  const activityCursor = input.cursor
    ? parseActivityCursor(input.cursor)!
    : { page: 1, snapshotAt: new Date() };

  const [totalPrimary, totalSecondary] = await Promise.all([
    countPrimaryActivity({
      includeCriticReviews,
      userCondition,
      snapshotAt: activityCursor.snapshotAt,
    }),
    countCollectionAddGroups({
      userCondition,
      snapshotAt: activityCursor.snapshotAt,
    }),
  ]);
  const sourceWindow = getActivitySourceWindow({
    cursor: activityCursor.page,
    limit: input.limit,
    totalPrimary,
    totalSecondary,
  });

  const [primaryRows, collectionGroupRows] = await Promise.all([
    getPrimaryActivity({
      includeCriticReviews,
      userCondition,
      snapshotAt: activityCursor.snapshotAt,
      limit: sourceWindow.primaryLimit,
      offset: sourceWindow.primaryOffset,
    }),
    getCollectionAddGroups({
      userCondition,
      snapshotAt: activityCursor.snapshotAt,
      limit: sourceWindow.secondaryLimit,
      offset: sourceWindow.secondaryOffset,
    }),
  ]);

  const primaryEntries = await serializePrimaryActivityEntries(
    primaryRows,
    context.user,
  );
  const secondaryEntries = await serializeCollectionAddEntries({
    groups: collectionGroupRows,
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
