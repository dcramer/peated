import { and, eq } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";

import { db } from "../db";
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
    if (!req.user) return res.status(401).send({ error: "Unauthorized" });

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

    const currentUser = req.user;
    const follow = await db.transaction(async (tx) => {
      const follow =
        (
          await tx
            .insert(follows)
            .values({
              fromUserId: currentUser.id,
              toUserId: user.id,
              status: isFollowedBy ? "following" : "pending",
            })
            .onConflictDoNothing()
            .returning()
        ).find(() => true) ||
        (
          await tx
            .update(follows)
            .set({
              status: isFollowedBy ? "following" : "pending",
            })
            .where(
              and(
                eq(follows.status, "none"),
                eq(follows.fromUserId, currentUser.id),
                eq(follows.toUserId, user.id),
              ),
            )
            .returning()
        ).find(() => true) ||
        (await db.query.follows.findFirst({
          where: (follows, { eq, and }) =>
            and(
              eq(follows.fromUserId, currentUser.id),
              eq(follows.toUserId, user.id),
            ),
        }));

      if (!follow) return;

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

    if (!follow) {
      return res.status(500).send({ error: "Failed to create follow" });
    }

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
