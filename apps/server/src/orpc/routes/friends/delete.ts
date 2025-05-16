import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import { follows, users } from "@peated/server/db/schema";
import { deleteNotification } from "@peated/server/lib/notifications";
import { procedure } from "@peated/server/orpc";
import { requireAuth } from "@peated/server/orpc/middleware/auth";
import type { FriendStatus } from "@peated/server/types";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAuth)
  .route({ method: "DELETE", path: "/friends/:id" })
  .input(z.coerce.number())
  .output(
    z.object({
      status: z.enum(["none", "pending", "following", "friends"]).optional(),
    }),
  )
  .handler(async function ({ input, context, errors }) {
    if (context.user.id === input) {
      throw errors.NOT_FOUND({
        message: "Cannot unfriend yourself.",
      });
    }

    const [user] = await db.select().from(users).where(eq(users.id, input));

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
