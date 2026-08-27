import { db } from "@peated/server/db";
import { follows, users } from "@peated/server/db/schema";
import { createNotification } from "@peated/server/lib/notifications";
import { implement } from "@peated/server/orpc";
import friendCreateContract from "@peated/server/orpc/contracts/friends/create";
import {
  requireAuth,
  requireTosAccepted,
} from "@peated/server/orpc/middleware/auth";
import type { FriendStatus } from "@peated/server/types";
import { and, eq, inArray } from "drizzle-orm";

export default implement(friendCreateContract)
  .use(requireAuth)
  .use(requireTosAccepted)
  .handler(async function ({ input, context, errors }) {
    const { user: userId } = input;

    if (context.user.id === userId) {
      throw errors.BAD_REQUEST({
        message: "Cannot friend yourself.",
      });
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId));

    if (!user) {
      throw errors.NOT_FOUND({
        message: "User not found.",
      });
    }

    // XXX: could make this a subquery to avoid a small race
    // Is this a new request or is it accepting a pending request?
    const isAccepting =
      (
        await db
          .select()
          .from(follows)
          .where(
            and(
              eq(follows.fromUserId, user.id),
              eq(follows.toUserId, context.user.id),
              inArray(follows.status, ["pending", "following"]),
            ),
          )
      ).length === 1;

    const currentUser = context.user;
    const myFollow = await db.transaction(async (tx) => {
      const currentStatus =
        (
          await tx
            .select({
              status: follows.status,
            })
            .from(follows)
            .where(
              and(
                eq(follows.fromUserId, currentUser.id),
                eq(follows.toUserId, user.id),
              ),
            )
        )
          .map((n) => n.status)
          .find((n) => !!n) || "none";

      const [myFollow] = await tx
        .insert(follows)
        .values({
          fromUserId: currentUser.id,
          toUserId: user.id,
          status: isAccepting ? "following" : "pending",
        })
        .onConflictDoUpdate({
          target: [follows.fromUserId, follows.toUserId],
          set: {
            status: isAccepting
              ? "following"
              : currentStatus === "none"
                ? "pending"
                : currentStatus,
          },
        })
        .returning();

      if (myFollow.status === "following") {
        await tx
          .insert(follows)
          .values({
            fromUserId: user.id,
            toUserId: currentUser.id,
            status: "following",
          })
          .onConflictDoUpdate({
            target: [follows.fromUserId, follows.toUserId],
            set: {
              status: "following",
            },
          });
      }

      if (!myFollow) return;

      if (myFollow.status === "pending")
        await createNotification(tx, {
          fromUserId: myFollow.fromUserId,
          type: "friend_request",
          objectId: myFollow.id,
          createdAt: myFollow.createdAt,
          userId: myFollow.toUserId,
        });

      return myFollow;
    });

    if (!myFollow) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Failed to create friend relationship.",
      });
    }

    return {
      status: myFollow.status === "following" ? "friends" : "pending",
    } satisfies {
      status: FriendStatus;
    };
  });
