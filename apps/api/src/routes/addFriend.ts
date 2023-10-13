import { and, eq, inArray } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";

import { db } from "@peated/shared/db";
import { follows, users } from "@peated/shared/db/schema";
import type { FriendStatus } from "@peated/shared/types";
import { createNotification } from "../lib/notifications";
import { requireAuth } from "../middleware/auth";

export default {
  method: "POST",
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
    if (!req.user) return res.status(401).send({ error: "Unauthorized" });

    if (req.user.id === req.params.userId) {
      return res.status(400).send({ error: "Cannot friend yourself" });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.params.userId));

    if (!user) {
      return res.status(404).send({ error: "Not found" });
    }

    // XXX: could make this a subquery to avoid a small race
    // Is this a new request or is it accepting a pending request?
    const isAccepting =
      (
        await db
          .select()
          .from(follows)
          .where(
            and(
              eq(follows.fromUserId, user.id),
              eq(follows.toUserId, req.user.id),
              inArray(follows.status, ["pending", "following"]),
            ),
          )
      ).length === 1;

    const currentUser = req.user;
    const myFollow = await db.transaction(async (tx) => {
      const currentStatus =
        (
          await db
            .select({
              status: follows.status,
            })
            .from(follows)
            .where(
              and(
                eq(follows.fromUserId, currentUser.id),
                eq(follows.toUserId, user.id),
              ),
            )
        )
          .map((n) => n.status)
          .find((n) => !!n) || "none";

      const [myFollow] = await tx
        .insert(follows)
        .values({
          fromUserId: currentUser.id,
          toUserId: user.id,
          status: isAccepting ? "following" : "pending",
        })
        .onConflictDoUpdate({
          target: [follows.fromUserId, follows.toUserId],
          set: {
            status: isAccepting
              ? "following"
              : currentStatus === "none"
              ? "pending"
              : currentStatus,
          },
        })
        .returning();

      if (myFollow.status === "following") {
        await tx
          .insert(follows)
          .values({
            fromUserId: user.id,
            toUserId: currentUser.id,
            status: "following",
          })
          .onConflictDoUpdate({
            target: [follows.fromUserId, follows.toUserId],
            set: {
              status: "following",
            },
          })
          .onConflictDoNothing();
      }

      if (!myFollow) return;

      if (myFollow.status === "pending")
        createNotification(tx, {
          fromUserId: myFollow.fromUserId,
          type: "friend_request",
          objectId: myFollow.id,
          createdAt: myFollow.createdAt,
          userId: myFollow.toUserId,
        });

      return myFollow;
    });

    if (!myFollow) {
      return res
        .status(500)
        .send({ error: "Failed to create friend relationship" });
    }

    res.status(200).send({
      status: myFollow.status === "following" ? "friends" : myFollow.status,
    } satisfies {
      status: FriendStatus;
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
