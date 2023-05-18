import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";

import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";
import { serialize } from "../lib/serializers";
import { UserSerializer } from "../lib/serializers/user";
import { requireAuth } from "../middleware/auth";

export default {
  method: "GET",
  url: "/auth",
  preHandler: [requireAuth],
  schema: {
    response: {
      200: {
        type: "object",
        required: ["user"],
        properties: {
          user: { $ref: "/schemas/user" },
        },
      },
      401: {
        $ref: "/errors/401",
      },
    },
  },
  handler: async function (req, res) {
    // this would be a good place to add refreshTokens (swap to POST for that)
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.user.id));
    if (!user) {
      return res.status(401).send({ error: "Unauthorized" });
    }

    if (!user.active) {
      return res.status(401).send({ error: "Unauthorized" });
    }

    return res.send({ user: await serialize(UserSerializer, user, req.user) });
  },
} as RouteOptions<Server, IncomingMessage, ServerResponse>;
