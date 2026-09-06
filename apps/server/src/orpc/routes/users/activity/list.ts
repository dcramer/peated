import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
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
import { getUserFromId, profileVisible } from "@peated/server/lib/api";
import { implement } from "@peated/server/orpc";
import userActivityListContract from "@peated/server/orpc/contracts/users/activity/list";
import { eq } from "drizzle-orm";

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
  const [totalPrimary, totalSecondary] = await Promise.all([
    countPrimaryActivity({
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
