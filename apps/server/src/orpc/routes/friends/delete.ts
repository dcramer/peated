import { db } from "@peated/server/db";
import { follows, users } from "@peated/server/db/schema";
import { deleteNotification } from "@peated/server/lib/notifications";
import { implement } from "@peated/server/orpc";
import friendDeleteContract from "@peated/server/orpc/contracts/friends/delete";
import {
  requireAuth,
  requireTosAccepted,
} from "@peated/server/orpc/middleware/auth";
import type { FriendStatus } from "@peated/server/types";
import { and, eq } from "drizzle-orm";

export default implement(friendDeleteContract)
  .use(requireAuth)
  .use(requireTosAccepted)
  .handler(async function ({ input, context, errors }) {
    const { user: userId } = input;

    if (context.user.id === userId) {
      throw errors.BAD_REQUEST({
        message: "Cannot unfriend yourself.",
      });
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId));

    if (!user) {
      throw errors.NOT_FOUND({
        message: "User not found.",
      });
    }

    const currentUser = context.user;
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
        await deleteNotification(tx, {
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
