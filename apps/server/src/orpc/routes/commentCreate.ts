import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import type {
  Comment,
  NewComment,
  Notification,
} from "@peated/server/db/schema";
import { comments, tastings } from "@peated/server/db/schema";
import { logError } from "@peated/server/lib/log";
import { createNotification } from "@peated/server/lib/notifications";
import { CommentInputSchema, CommentSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { CommentSerializer } from "@peated/server/serializers/comment";
import { pushJob } from "@peated/server/worker/client";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { procedure } from "..";
import { requireAuth } from "../middleware";

export default procedure
  .use(requireAuth)
  .route({ method: "POST", path: "/comments" })
  .input(
    CommentInputSchema.extend({
      tasting: z.coerce.number(),
    }),
  )
  .output(CommentSchema)
  .handler(async function ({ input, context }) {
    const tasting = await db.query.tastings.findFirst({
      where: (tastings, { eq }) => eq(tastings.id, input.tasting),
      with: {
        createdBy: true,
        bottle: true,
      },
    });

    if (!tasting) {
      throw new ORPCError("NOT_FOUND", {
        message: "Tasting not found.",
      });
    }

    const data: NewComment = {
      comment: input.comment,
      tastingId: tasting.id,
      createdById: context.user.id,
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
          throw new ORPCError("CONFLICT", {
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
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
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

    return await serialize(CommentSerializer, comment, context.user);
  });
