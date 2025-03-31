import { db } from "@peated/server/db";
import type {
  Comment,
  NewComment,
  Notification,
} from "@peated/server/db/schema";
import { comments, tastings, users } from "@peated/server/db/schema";
import { logError } from "@peated/server/lib/log";
import { createNotification } from "@peated/server/lib/notifications";
import { CommentInputSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { CommentSerializer } from "@peated/server/serializers/comment";
import { pushJob } from "@peated/server/worker/client";
import { TRPCError } from "@trpc/server";
import { eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { authedProcedure } from "..";

// Helper function to extract mentions from comment text
function extractMentions(text: string): string[] {
  const mentionRegex = /@(\w+)/g;
  const matches = text.match(mentionRegex) || [];
  return matches.map((match) => match.substring(1)); // Remove @ symbol
}

export default authedProcedure
  .input(
    CommentInputSchema.extend({
      tasting: z.number(),
      mentionedUsernames: z.array(z.string()).optional(),
    }),
  )
  .mutation(async function ({ input, ctx }) {
    try {
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

      // Check if this is a reply and the parent comment exists
      let replyToComment = null;
      if (input.replyToId !== undefined && input.replyToId !== null) {
        try {
          const replyToId = Number(input.replyToId);
          replyToComment = await db.query.comments.findFirst({
            where: (comments, { eq }) => eq(comments.id, replyToId),
            with: {
              createdBy: true,
            },
          });

          if (!replyToComment) {
            throw new TRPCError({
              message: "Parent comment not found.",
              code: "NOT_FOUND",
            });
          }

          // Ensure parent comment belongs to the same tasting
          if (replyToComment.tastingId !== tasting.id) {
            throw new TRPCError({
              message: "Parent comment does not belong to this tasting.",
              code: "BAD_REQUEST",
            });
          }
        } catch (err) {
          console.error("Error checking parent comment:", err);
          // Continue without the replyToId if there's an error
          input.replyToId = null;
        }
      }

      // Get mentioned users
      let mentionedUsers: { id: number; username: string }[] = [];
      if (input.mentionedUsernames && input.mentionedUsernames.length > 0) {
        mentionedUsers = await db
          .select({ id: users.id, username: users.username })
          .from(users)
          .where(inArray(users.username, input.mentionedUsernames));
      }

      const data: Partial<NewComment> = {
        comment: input.comment,
        tastingId: tasting.id,
        createdById: ctx.user.id,
      };

      if (input.createdAt) {
        data.createdAt = new Date(input.createdAt);
      }

      const [comment, notifications] = await db.transaction(async (tx) => {
        let comment: Comment | undefined;
        try {
          const result = await tx
            .insert(comments)
            .values(data as NewComment)
            .onConflictDoNothing()
            .returning();

          if (result && result.length > 0) {
            comment = result[0];
          }
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
        if (!comment) return [undefined, []];

        await tx
          .update(tastings)
          .set({ comments: sql`${tastings.comments} + 1` })
          .where(eq(tastings.id, tasting.id));

        // Create notifications
        const notifications: Notification[] = [];

        // Notify tasting owner (if not the commenter)
        if (comment.createdById !== tasting.createdById) {
          try {
            const notif = await createNotification(tx, {
              fromUserId: comment.createdById,
              type: "comment",
              objectId: comment.id,
              createdAt: comment.createdAt,
              userId: tasting.createdById,
            });
            if (notif) notifications.push(notif);
          } catch (err) {
            console.warn("Error creating notification:", err);
          }
        }

        // If this is a reply, notify the parent comment author
        if (
          replyToComment &&
          replyToComment.createdById !== ctx.user.id &&
          replyToComment.createdById !== tasting.createdById
        ) {
          try {
            const notif = await createNotification(tx, {
              fromUserId: comment.createdById,
              type: "comment", // Use regular comment type since we don't have comment_reply
              objectId: comment.id,
              createdAt: comment.createdAt,
              userId: replyToComment.createdById,
            });
            if (notif) notifications.push(notif);
          } catch (err) {
            console.warn("Error creating reply notification:", err);
          }
        }

        // Notify mentioned users
        for (const mentionedUser of mentionedUsers) {
          // Don't notify self or users already notified
          if (
            mentionedUser.id === ctx.user.id ||
            mentionedUser.id === tasting.createdById ||
            (replyToComment && replyToComment.createdById === mentionedUser.id)
          ) {
            continue;
          }

          try {
            const notif = await createNotification(tx, {
              fromUserId: comment.createdById,
              type: "comment", // Use regular comment type since we don't have comment_mention
              objectId: comment.id,
              createdAt: comment.createdAt,
              userId: mentionedUser.id,
            });
            if (notif) notifications.push(notif);
          } catch (err) {
            console.warn(
              `Error creating mention notification for ${mentionedUser.username}:`,
              err,
            );
          }
        }

        return [comment, notifications];
      });

      if (!comment) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Unable to create comment.",
        });
      }

      // Process notifications
      if (notifications.length > 0) {
        try {
          for (const notif of notifications) {
            await pushJob("ProcessNotification", { notificationId: notif.id });
          }
        } catch (err) {
          logError(err, {
            notification: {
              count: notifications.length,
            },
          });
        }
      }

      // Add the replyToId and mentionedUsernames to the response
      const result = await serialize(CommentSerializer, comment, ctx.user);
      if (input.replyToId !== undefined && input.replyToId !== null) {
        result.replyToId = input.replyToId;
      }

      // Add mentioned usernames to the result
      if (mentionedUsers.length > 0) {
        result.mentionedUsernames = mentionedUsers.map((u) => u.username);
      }

      return result;
    } catch (error) {
      console.error("Error in commentCreate:", error);
      throw error;
    }
  });
