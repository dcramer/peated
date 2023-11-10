import { db } from "@peated/server/db";
import type { Comment, NewComment } from "@peated/server/db/schema";
import { comments, tastings } from "@peated/server/db/schema";
import { isDistantFuture, isDistantPast } from "@peated/server/lib/dates";
import { notifyComment } from "@peated/server/lib/email";
import { createNotification } from "@peated/server/lib/notifications";
import { CommentInputSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { CommentSerializer } from "@peated/server/serializers/comment";
import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { authedProcedure } from "..";

export default authedProcedure
  .input(
    CommentInputSchema.extend({
      tasting: z.number(),
    }),
  )
  .mutation(async function ({ input, ctx }) {
    const tasting = await db.query.tastings.findFirst({
      where: (tastings, { eq }) => eq(tastings.id, input.tasting),
      with: {
        createdBy: true,
        bottle: true,
      },
    });

    if (!tasting) {
      throw new TRPCError({
        message: "Tasting not found.",
        code: "NOT_FOUND",
      });
    }

    const data: NewComment = {
      comment: input.comment,
      tastingId: tasting.id,
      createdById: ctx.user.id,
    };
    if (input.createdAt) {
      data.createdAt = new Date(input.createdAt);
      if (isDistantFuture(data.createdAt, 60 * 5)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "createdAt too far in future.",
        });
      }
      if (isDistantPast(data.createdAt, 60 * 60 * 24 * 7)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "createdAt too far in past.",
        });
      }
    }

    const user = ctx.user;
    const comment = await db.transaction(async (tx) => {
      let comment: Comment | undefined;
      try {
        [comment] = await tx
          .insert(comments)
          .values(data)
          .onConflictDoNothing()
          .returning();
      } catch (err: any) {
        if (err?.code === "23505" && err?.constraint === "comment_unq") {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Comment already exists.",
          });
        }
        throw err;
      }
      if (!comment) return;

      await tx
        .update(tastings)
        .set({ comments: sql`${tastings.comments} + 1` })
        .where(eq(tastings.id, tasting.id));

      if (comment.createdById !== tasting.createdById) {
        createNotification(tx, {
          fromUserId: comment.createdById,
          type: "comment",
          objectId: comment.id,
          createdAt: comment.createdAt,
          userId: tasting.createdById,
        });

        await notifyComment({
          comment: {
            ...comment,
            createdBy: user,
            tasting,
          },
        });
      }

      return comment;
    });

    if (!comment) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Unable to create comment.",
      });
    }

    return await serialize(CommentSerializer, comment, ctx.user);
  });
