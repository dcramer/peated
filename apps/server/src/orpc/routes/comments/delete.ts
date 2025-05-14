import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import { comments, tastings } from "@peated/server/db/schema";
import { deleteNotification } from "@peated/server/lib/notifications";
import { procedure } from "@peated/server/orpc";
import { requireAuth } from "@peated/server/orpc/middleware";
import { and, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAuth)
  .route({ method: "DELETE", path: "/comments/:id" })
  .input(z.coerce.number())
  .output(z.object({}))
  .handler(async function ({ input, context }) {
    const [comment] = await db
      .select()
      .from(comments)
      .where(eq(comments.id, input))
      .limit(1);
    if (!comment) {
      throw new ORPCError("NOT_FOUND", {
        message: "Comment not found.",
      });
    }

    if (comment.createdById !== context.user.id && !context.user.admin) {
      throw new ORPCError("FORBIDDEN", {
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
