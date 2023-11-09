import { db } from "@peated/server/db";
import { comments, tastings } from "@peated/server/db/schema";
import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { authedProcedure } from "..";
import { deleteNotification } from "../../lib/notifications";

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

  await db.transaction(async (tx) => {
    await tx
      .update(tastings)
      .set({ comments: sql`${tastings.comments} - 1` })
      .where(eq(tastings.id, comment.tastingId));

    await deleteNotification(tx, {
      type: "comment",
      objectId: comment.id,
      userId: comment.createdById,
    });

    await tx.delete(comments).where(eq(comments.id, comment.id));
  });

  return {};
});
