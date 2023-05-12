import { and, eq } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";
import { db } from "../db";
import { follows, users } from "../db/schema";
import { requireAuth } from "../middleware/auth";

export default {
  method: "POST",
  url: "/users/:userId/unfollow",
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
      return res.status(400).send({ error: "Cannot unfollow yourself" });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.params.userId));

    if (!user) {
      return res.status(404).send({ error: "Not found" });
    }

    await db
      .update(follows)
      .set({
        status: "none",
      })
      .where(
        and(eq(follows.fromUserId, req.user.id), eq(follows.toUserId, user.id)),
      );

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
