import { FollowSchema } from "@peated/shared/schemas";
import { and, eq } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";
import zodToJsonSchema from "zod-to-json-schema";
import { db } from "../db";
import { follows } from "../db/schema";
import { serialize } from "../lib/serializers";
import { FollowerSerializer } from "../lib/serializers/follow";
import { requireAuth } from "../middleware/auth";

export default {
  method: "PUT",
  url: "/followers/:followId",
  schema: {
    params: {
      type: "object",
      required: ["followId"],
      properties: {
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
    response: {
      200: zodToJsonSchema(FollowSchema),
    },
  },
  preHandler: [requireAuth],
  handler: async (req, res) => {
    const [follow] = await db
      .select()
      .from(follows)
      .where(
        and(
          eq(follows.id, req.params.followId),
          eq(follows.toUserId, req.user.id),
        ),
      );

    if (!follow) {
      return res.status(404).send({ error: "Not found" });
    }

    const [newFollow] = await db
      .update(follows)
      .set({
        status: req.body.action === "accept" ? "following" : follow.status,
      })
      .where(
        and(
          eq(follows.id, req.params.followId),
          eq(follows.toUserId, req.user.id),
        ),
      )
      .returning();

    res.send(await serialize(FollowerSerializer, newFollow, req.user));
  },
} as RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Params: {
      userId: number | "me";
      followId: number;
    };
    Body: {
      action: "accept";
    };
  }
>;
