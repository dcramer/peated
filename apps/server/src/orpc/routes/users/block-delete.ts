import { db } from "@peated/server/db";
import { userBlocks } from "@peated/server/db/schema";
import { getUserFromId } from "@peated/server/lib/api";
import { procedure } from "@peated/server/orpc";
import { requireAuth } from "@peated/server/orpc/middleware";
import { UserSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { UserSerializer } from "@peated/server/serializers/user";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAuth)
  .route({
    method: "DELETE",
    path: "/users/{user}/block",
    summary: "Unblock a member",
    description:
      "Remove your block on a member. A block the other member placed on you stays. Unblocking a member you have not blocked changes nothing.",
    operationId: "unblockUser",
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

    await db
      .delete(userBlocks)
      .where(
        and(
          eq(userBlocks.userId, context.user.id),
          eq(userBlocks.blockedUserId, user.id),
        ),
      );

    return await serialize(UserSerializer, user, context.user);
  });
