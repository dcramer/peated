import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import { follows } from "@peated/server/db/schema";
import { and, eq, inArray } from "drizzle-orm";

/** Requires every tagged friend to be someone the member actively follows. */
export async function validateFriends(
  userId: number,
  friends: number[],
): Promise<void> {
  const followed = await keepFollowedFriends(userId, friends);
  if (followed.length !== new Set(friends).size) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Friends must all be active relationships.",
    });
  }
}

/**
 * Returns the tagged friends the member still actively follows, without
 * duplicates. Tasting drafts use it instead of `validateFriends`: a draft can
 * wait weeks, and a friendship that ended meanwhile must not block it.
 */
export async function keepFollowedFriends(
  userId: number,
  friends: number[],
): Promise<number[]> {
  if (friends.length === 0) return [];
  const friendUserIds = Array.from(new Set(friends));
  const matches = await db
    .select({ toUserId: follows.toUserId })
    .from(follows)
    .where(
      and(
        eq(follows.fromUserId, userId),
        eq(follows.status, "following"),
        inArray(follows.toUserId, friendUserIds),
      ),
    );
  const followed = new Set(matches.map(({ toUserId }) => toUserId));
  return friendUserIds.filter((id) => followed.has(id));
}
