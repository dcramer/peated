import { db } from "@peated/server/db";
import { comments, tastings } from "@peated/server/db/schema";
import { deleteNotification } from "@peated/server/lib/notifications";
import { procedure } from "@peated/server/orpc";
import { requireAuth } from "@peated/server/orpc/middleware";
import { and, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAuth)
  .route({
    method: "DELETE",
    path: "/comments/{comment}",
    summary: "Delete comment",
    description:
      "Delete a comment and update related counters. Requires authentication and ownership or admin privileges",
  })
  // .route({
  //   method: "DELETE",
  //   path: "/tastings/{tasting}/comments/{id}",
  //   tags: ["tastings"],
  // })
  // .route({
  //   method: "DELETE",
  //   path: "/users/{user}/comments/{id}",
  //   tags: ["users"],
  // })
  .input(
    z.object({
      comment: z.coerce.number(),
      // user: z.coerce.number().optional(),
      // tasting: z.coerce.number().optional(),
    }),
  )
  .output(z.object({}))
  .handler(async function ({ input, context, errors }) {
    const [comment] = await db
      .select()
      .from(comments)
      .where(eq(comments.id, input.comment))
      .limit(1);
    if (!comment) {
      throw errors.NOT_FOUND({
        message: "Comment not found.",
      });
    }

    if (comment.createdById !== context.user.id && !context.user.admin) {
      throw errors.FORBIDDEN({
        message: "Cannot delete another user's comment.",
      });
    }

    await db.transaction(async (tx) => {
      await tx
        .update(tastings)
        .set({ comments: sql`${tastings.comments} - 1` })
        .where(
          and(eq(tastings.id, comment.tastingId), gt(tastings.comments, 0)),
        );

      await deleteNotification(tx, {
        type: "comment",
        objectId: comment.id,
        userId: comment.createdById,
      });

      await tx.delete(comments).where(eq(comments.id, comment.id));
    });

    return {};
  });
