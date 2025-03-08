import { db } from "@peated/server/db";
import { comments, notifications, tastings } from "@peated/server/db/schema";
import { TRPCError } from "@trpc/server";
import { and, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import { authedProcedure } from "..";

export default authedProcedure.input(z.number()).mutation(async function ({
  input,
  ctx,
}) {
  const [comment] = await db
    .select()
    .from(comments)
    .where(eq(comments.id, input))
    .limit(1);
  if (!comment) {
    throw new TRPCError({
      message: "Comment not found.",
      code: "NOT_FOUND",
    });
  }

  if (comment.createdById !== ctx.user.id && !ctx.user.admin) {
    throw new TRPCError({
      message: "Cannot delete another user's comment.",
      code: "FORBIDDEN",
    });
  }

  const replies = await db
    .select()
    .from(comments)
    .where(eq(comments.parentId, comment.id));

  await db.transaction(async (tx) => {
    const decrementAmount = 1 + replies.length;

    await tx
      .update(tastings)
      .set({ comments: sql`${tastings.comments} - ${decrementAmount}` })
      .where(and(eq(tastings.id, comment.tastingId), gt(tastings.comments, 0)));

    await tx
      .delete(notifications)
      .where(
        and(
          eq(notifications.type, "comment"),
          eq(notifications.objectId, comment.id),
        ),
      );

    for (const reply of replies) {
      await tx
        .delete(notifications)
        .where(
          and(
            eq(notifications.type, "comment"),
            eq(notifications.objectId, reply.id),
          ),
        );
    }

    await tx.delete(comments).where(eq(comments.id, comment.id));
  });

  return {};
});
