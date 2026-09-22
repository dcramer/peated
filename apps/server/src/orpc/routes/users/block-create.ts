import { db } from "@peated/server/db";
import { follows, userBlocks } from "@peated/server/db/schema";
import { getUserFromId } from "@peated/server/lib/api";
import { deleteNotification } from "@peated/server/lib/notifications";
import { procedure } from "@peated/server/orpc";
import { requireAuth } from "@peated/server/orpc/middleware";
import { UserSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { UserSerializer } from "@peated/server/serializers/user";
import { and, eq, or } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAuth)
  .route({
    method: "POST",
    path: "/users/{user}/block",
    summary: "Block a member",
    description:
      "Stop a member from commenting on, toasting, or sending friend requests to you, and stop you from doing the same to them. Any friendship or pending request between you is removed. Content stays visible. Blocking again changes nothing.",
    operationId: "blockUser",
  })
  .input(
    z.object({
      user: z.union([z.coerce.number(), z.string()]),
    }),
  )
  .output(UserSchema)
  .handler(async ({ input, context, errors }) => {
    const user = await getUserFromId(db, input.user, context.user);
    if (!user) {
      throw errors.NOT_FOUND({ message: "User not found." });
    }
    if (user.id === context.user.id) {
      throw errors.BAD_REQUEST({ message: "You cannot block yourself." });
    }

    const currentUser = context.user;
    await db.transaction(async (tx) => {
      await tx
        .insert(userBlocks)
        .values({ userId: currentUser.id, blockedUserId: user.id })
        .onConflictDoNothing();

      // A block ends any friendship or pending request in both directions.
      const ended = await tx
        .update(follows)
        .set({ status: "none" })
        .where(
          or(
            and(
              eq(follows.fromUserId, currentUser.id),
              eq(follows.toUserId, user.id),
            ),
            and(
              eq(follows.fromUserId, user.id),
              eq(follows.toUserId, currentUser.id),
            ),
          ),
        )
        .returning();
      for (const follow of ended) {
        await deleteNotification(tx, {
          type: "friend_request",
          objectId: follow.id,
          userId: follow.toUserId,
        });
      }
    });

    return await serialize(UserSerializer, user, context.user);
  });
