import { db } from "@peated/server/db";
import type {
  Comment,
  NewComment,
  Notification,
} from "@peated/server/db/schema";
import { comments, tastings } from "@peated/server/db/schema";
import { logError } from "@peated/server/lib/log";
import { createNotification } from "@peated/server/lib/notifications";
import { CommentInputSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { CommentSerializer } from "@peated/server/serializers/comment";
import { pushJob } from "@peated/server/worker/client";
import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { authedProcedure } from "../trpc";

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
    }

    const [comment, notif] = await db.transaction(async (tx) => {
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
            cause: err,
          });
        }
        throw err;
      }
      if (!comment) return [];

      await tx
        .update(tastings)
        .set({ comments: sql`${tastings.comments} + 1` })
        .where(eq(tastings.id, tasting.id));

      let notif: Notification | null = null;
      if (comment.createdById !== tasting.createdById) {
        notif = await createNotification(tx, {
          fromUserId: comment.createdById,
          type: "comment",
          objectId: comment.id,
          createdAt: comment.createdAt,
          userId: tasting.createdById,
        });
      }

      return [comment, notif];
    });

    if (!comment) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Unable to create comment.",
      });
    }

    if (notif) {
      try {
        await pushJob("ProcessNotification", { notificationId: notif.id });
      } catch (err) {
        logError(err, {
          notification: {
            id: notif.id,
          },
        });
      }
    }

    return await serialize(CommentSerializer, comment, ctx.user);
  });
