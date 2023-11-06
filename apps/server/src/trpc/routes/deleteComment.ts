import { db } from "@peated/server/db";
import { comments, tastings } from "@peated/server/db/schema";
import { eq, sql } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";
import { deleteNotification } from "../lib/notifications";
import { requireAuth } from "../middleware/auth";

export default {
  method: "DELETE",
  url: "/comments/:commentId",
  schema: {
    params: {
      type: "object",
      required: ["commentId"],
      properties: {
        commentId: { type: "number" },
      },
    },
  },
  preHandler: [requireAuth],
  handler: async (req, res) => {
    if (!req.user) return res.status(401).send({ error: "Unauthorized" });

    const [comment] = await db
      .select()
      .from(comments)
      .where(eq(comments.id, req.params.commentId))
      .limit(1);
    if (!comment) {
      return res.status(404).send({ error: "Not found" });
    }

    if (comment.createdById !== req.user.id && !req.user.admin) {
      return res.status(403).send({ error: "Forbidden" });
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
    res.status(204).send();
  },
} as RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Params: {
      commentId: number;
    };
  }
>;
