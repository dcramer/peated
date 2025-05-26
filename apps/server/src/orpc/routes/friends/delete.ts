import { db } from "@peated/server/db";
import { follows, users } from "@peated/server/db/schema";
import { deleteNotification } from "@peated/server/lib/notifications";
import { procedure } from "@peated/server/orpc";
import { requireAuth } from "@peated/server/orpc/middleware/auth";
import { FriendStatusEnum } from "@peated/server/schemas";
import type { FriendStatus } from "@peated/server/types";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAuth)
  // TODO: better path
  .route({ method: "DELETE", path: "/friends/{user}" })
  .input(z.object({ user: z.coerce.number() }))
  .output(
    z.object({
      status: FriendStatusEnum,
    }),
  )
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
