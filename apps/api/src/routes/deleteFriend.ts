import { and, eq } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";
import { db } from "../db";
import { follows, users } from "../db/schema";
import { deleteNotification } from "../lib/notifications";
import { requireAuth } from "../middleware/auth";

export default {
  method: "DELETE",
  url: "/friends/:userId",
  schema: {
    params: {
      type: "object",
      required: ["userId"],
      properties: {
        userId: { type: "number" },
      },
    },
  },
  preHandler: [requireAuth],
  handler: async (req, res) => {
    if (!req.user) return res.status(401);

    if (req.user.id === req.params.userId) {
      return res.status(400).send({ error: "Cannot unfriend yourself" });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.params.userId));

    if (!user) {
      return res.status(404).send({ error: "Not found" });
    }

    const currentUser = req.user;
    await db.transaction(async (tx) => {
      const [follow] = await tx
        .update(follows)
        .set({
          status: "none",
        })
        .where(
          and(
            eq(follows.fromUserId, currentUser.id),
            eq(follows.toUserId, user.id),
          ),
        )
        .returning();

      await tx
        .update(follows)
        .set({
          status: "none",
        })
        .where(
          and(
            eq(follows.fromUserId, user.id),
            eq(follows.toUserId, currentUser.id),
          ),
        );

      if (follow)
        deleteNotification(tx, {
          type: "friend_request",
          objectId: follow.id,
          userId: follow.toUserId,
        });
    });

    res.status(200).send({
      status: "none",
    });
  },
} as RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Params: {
      userId: number;
    };
  }
>;
