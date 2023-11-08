import { db } from "@peated/server/db";
import { follows, users } from "@peated/server/db/schema";
import { createNotification } from "@peated/server/lib/notifications";
import type { FriendStatus } from "@peated/server/types";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { authedProcedure } from "..";

export default authedProcedure.input(z.number()).mutation(async function ({
  input,
  ctx,
}) {
  if (ctx.user.id === input) {
    throw new TRPCError({
      message: "Cannot friend yourself.",
      code: "BAD_REQUEST",
    });
  }

  const [user] = await db.select().from(users).where(eq(users.id, input));

  if (!user) {
    throw new TRPCError({
      message: "User not found.",
      code: "NOT_FOUND",
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
            eq(follows.toUserId, ctx.user.id),
            inArray(follows.status, ["pending", "following"]),
          ),
        )
    ).length === 1;

  const currentUser = ctx.user;
  const myFollow = await db.transaction(async (tx) => {
    const currentStatus =
      (
        await db
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
        })
        .onConflictDoNothing();
    }

    if (!myFollow) return;

    if (myFollow.status === "pending")
      createNotification(tx, {
        fromUserId: myFollow.fromUserId,
        type: "friend_request",
        objectId: myFollow.id,
        createdAt: myFollow.createdAt,
        userId: myFollow.toUserId,
      });

    return myFollow;
  });

  if (!myFollow) {
    throw new TRPCError({
      message: "Failed to create friend relationship.",
      code: "INTERNAL_SERVER_ERROR",
    });
  }

  return {
    status: myFollow.status === "following" ? "friends" : myFollow.status,
  } satisfies {
    status: FriendStatus;
  };
});
