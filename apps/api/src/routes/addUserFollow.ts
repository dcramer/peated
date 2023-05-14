import { and, eq } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";
import { db, first } from "../db";
import { follows, users } from "../db/schema";
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

    const follow =
      first(
        await db
          .insert(follows)
          .values({
            fromUserId: req.user.id,
            toUserId: user.id,
          })
          .onConflictDoNothing()
          .returning(),
      ) ||
      first(
        await db
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
        await db
          .select()
          .from(follows)
          .where(
            and(
              eq(follows.fromUserId, req.user.id),
              eq(follows.toUserId, user.id),
            ),
          ),
      );

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
