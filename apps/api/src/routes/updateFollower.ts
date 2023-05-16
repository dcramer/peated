import { and, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";
import { db, first } from "../db";
import { follows, users } from "../db/schema";
import { serializeFollow } from "../lib/serializers/follow";
import { requireAuth } from "../middleware/auth";

export default {
  method: "PUT",
  url: "/users/:userId/followers/:fromUserId",
  schema: {
    params: {
      type: "object",
      required: ["userId", "fromUserId"],
      properties: {
        userId: { oneOf: [{ type: "number" }, { const: "me" }] },
        fromUserId: { type: "number" },
      },
    },
    body: {
      type: "object",
      required: ["action"],
      properties: {
        action: { type: "string", enum: ["accept"] },
      },
    },
  },
  preHandler: [requireAuth],
  handler: async (req, res) => {
    const userId = req.params.userId === "me" ? req.user.id : req.params.userId;

    const [user] = await db.select().from(users).where(eq(users.id, userId));

    if (!user) {
      return res.status(404).send({ error: "Not found" });
    }

    if (user.id !== req.user.id && !req.user.admin) {
      return res.status(403).send({ error: "Forbidden" });
    }

    const followsBackTable = alias(follows, "follows_back");
    const result = first(
      await db
        .select({
          followUser: users,
          follow: follows,
          followsBack: followsBackTable,
        })
        .from(follows)
        .innerJoin(users, eq(users.id, follows.fromUserId))
        .leftJoin(followsBackTable, eq(users.id, followsBackTable.toUserId))
        .where(
          and(
            eq(follows.fromUserId, req.params.fromUserId),
            eq(follows.toUserId, user.id),
          ),
        ),
    );

    if (!result) {
      return res.status(404).send({ error: "Not found" });
    }
    const { follow, followUser, followsBack } = result;

    const [newFollow] = await db
      .update(follows)
      .set({
        status: req.body.action === "accept" ? "following" : follow.status,
      })
      .where(
        and(
          eq(follows.fromUserId, req.params.fromUserId),
          eq(follows.toUserId, user.id),
        ),
      )
      .returning();

    res.send(
      serializeFollow(
        {
          ...newFollow,
          user: followUser,
          followsBack: followsBack?.status || "none",
        },
        req.user,
      ),
    );
  },
} as RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Params: {
      userId: number | "me";
      fromUserId: number;
    };
    Body: {
      action: "accept";
    };
  }
>;
