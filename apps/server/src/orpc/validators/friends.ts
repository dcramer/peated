import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import { follows } from "@peated/server/db/schema";
import { and, eq, inArray } from "drizzle-orm";

/** Requires every tagged friend to be someone the member actively follows. */
export async function validateFriends(
  userId: number,
  friends: number[],
): Promise<void> {
  if (friends.length === 0) return;
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
  if (matches.length != friendUserIds.length) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Friends must all be active relationships.",
    });
  }
}
