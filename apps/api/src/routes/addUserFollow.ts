import { and, eq } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";
import { db, first } from "../db";
import { follows, users } from "../db/schema";
import { createNotification, objectTypeFromSchema } from "../lib/notifications";
import { requireAuth } from "../middleware/auth";

export default {
  method: "POST",
  url: "/users/:userId/follow",
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
    if (req.user.id === req.params.userId) {
      return res.status(400).send({ error: "Cannot follow yourself" });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.params.userId));

    if (!user) {
      return res.status(404).send({ error: "Not found" });
    }

    const follow = await db.transaction(async (tx) => {
      const follow =
        first(
          await tx
            .insert(follows)
            .values({
              fromUserId: req.user.id,
              toUserId: user.id,
            })
            .onConflictDoNothing()
            .returning(),
        ) ||
        first(
          await tx
            .update(follows)
            .set({
              status: "pending",
            })
            .where(
              and(
                eq(follows.status, "none"),
                eq(follows.fromUserId, req.user.id),
                eq(follows.toUserId, user.id),
              ),
            )
            .returning(),
        ) ||
        first(
          await tx
            .select()
            .from(follows)
            .where(
              and(
                eq(follows.fromUserId, req.user.id),
                eq(follows.toUserId, user.id),
              ),
            ),
        );

      if (follow)
        createNotification(tx, {
          fromUserId: follow.createdById,
          objectType: objectTypeFromSchema(follows),
          objectId: follow.fromUserId,
          createdAt: follow.createdAt,
          userId: follow.toUserId,
        });

      return follow;
    });

    res.status(200).send({
      status: follow.status,
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
