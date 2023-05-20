import { CommentInputSchema, CommentSchema } from "@peated/shared/schemas";
import { eq, sql } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";
import zodToJsonSchema from "zod-to-json-schema";
import { db, first } from "../db";
import { Comment, NewComment, comments, tastings } from "../db/schema";
import { isDistantFuture, isDistantPast } from "../lib/dates";
import { createNotification, objectTypeFromSchema } from "../lib/notifications";
import { serialize } from "../lib/serializers";
import { CommentSerializer } from "../lib/serializers/comment";
import { requireAuth } from "../middleware/auth";

export default {
  method: "POST",
  url: "/tastings/:tastingId/comments",
  schema: {
    params: {
      type: "object",
      required: ["tastingId"],
      properties: {
        tastingId: { type: "number" },
      },
    },
    body: zodToJsonSchema(CommentInputSchema),
    response: {
      201: zodToJsonSchema(CommentSchema),
    },
  },
  preHandler: [requireAuth],
  handler: async (req, res) => {
    const tasting = first(
      await db
        .select()
        .from(tastings)
        .where(eq(tastings.id, req.params.tastingId)),
    );

    if (!tasting) {
      return res.status(404).send({ error: "Not found" });
    }

    const data: NewComment = {
      comment: req.body.comment,
      tastingId: tasting.id,
      createdById: req.user.id,
    };
    if (req.body.createdAt) {
      data.createdAt = new Date(req.body.createdAt);
      if (isDistantFuture(data.createdAt, 60 * 5)) {
        return res.status(400).send({ error: "createdAt too far in future" });
      }
      if (isDistantPast(data.createdAt, 60 * 60 * 24 * 7)) {
        return res.status(400).send({ error: "createdAt too far in past" });
      }
    }

    const comment = await db.transaction(async (tx) => {
      const comment = first<Comment>(
        await tx
          .insert(comments)
          .values(data)
          .onConflictDoNothing()
          .returning(),
      );

      if (comment) {
        await tx
          .update(tastings)
          .set({ comments: sql`${tastings.comments} + 1` })
          .where(eq(tastings.id, tasting.id));

        if (comment.createdById !== tasting.createdById)
          createNotification(tx, {
            fromUserId: comment.createdById,
            objectType: objectTypeFromSchema(comments),
            objectId: comment.id,
            createdAt: comment.createdAt,
            userId: tasting.createdById,
          });
      }

      return comment;
    });

    if (!comment) return res.status(409).send({});

    res.status(200).send(serialize(CommentSerializer, comment, req.user));
  },
} as RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Params: {
      tastingId: number;
    };
    Body: {
      comment: string;
      createdAt?: string;
    };
  }
>;
