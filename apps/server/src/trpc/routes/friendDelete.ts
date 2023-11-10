import { db } from "@peated/server/db";
import { follows, users } from "@peated/server/db/schema";
import type { FriendStatus } from "@peated/server/types";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { authedProcedure } from "..";
import { deleteNotification } from "../../lib/notifications";

export default authedProcedure.input(z.number()).mutation(async function ({
  input,
  ctx,
}) {
  if (ctx.user.id === input) {
    throw new TRPCError({
      message: "Cannot unfriend yourself.",
      code: "NOT_FOUND",
    });
  }

  const [user] = await db.select().from(users).where(eq(users.id, input));

  if (!user) {
    throw new TRPCError({
      message: "User not found.",
      code: "NOT_FOUND",
    });
  }

  const currentUser = ctx.user;
  await db.transaction(async (tx) => {
    const [follow] = await tx
      .update(follows)
      .set({
        status: "none",
      })
      .where(
        and(
          eq(follows.fromUserId, currentUser.id),
          eq(follows.toUserId, user.id),
        ),
      )
      .returning();

    await tx
      .update(follows)
      .set({
        status: "none",
      })
      .where(
        and(
          eq(follows.fromUserId, user.id),
          eq(follows.toUserId, currentUser.id),
        ),
      );

    if (follow)
      deleteNotification(tx, {
        type: "friend_request",
        objectId: follow.id,
        userId: follow.toUserId,
      });
  });

  return {
    status: "none",
  } satisfies {
    status: FriendStatus;
  };
});
