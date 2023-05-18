import { and, eq } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";
import { db, first } from "../db";
import { Follow, follows, users } from "../db/schema";
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

    // XXX: could make this a subquery to avoid a small race
    const isFollowedBy =
      (
        await db
          .select()
          .from(follows)
          .where(
            and(
              eq(follows.fromUserId, user.id),
              eq(follows.toUserId, req.user.id),
              eq(follows.status, "following"),
            ),
          )
      ).length === 1;

    const follow = await db.transaction(async (tx) => {
      const follow =
        first<Follow>(
          await tx
            .insert(follows)
            .values({
              fromUserId: req.user.id,
              toUserId: user.id,
              status: isFollowedBy ? "following" : "pending",
            })
            .onConflictDoNothing()
            .returning(),
        ) ||
        first<Follow>(
          await tx
            .update(follows)
            .set({
              status: isFollowedBy ? "following" : "pending",
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
        (
          await tx
            .select()
            .from(follows)
            .where(
              and(
                eq(follows.fromUserId, req.user.id),
                eq(follows.toUserId, user.id),
              ),
            )
        )[0];

      if (follow.status === "pending")
        createNotification(tx, {
          fromUserId: follow.fromUserId,
          objectType: objectTypeFromSchema(follows),
          objectId: follow.id,
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
