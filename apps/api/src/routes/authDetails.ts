import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";

import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";
import { serializeUser } from "../lib/serializers/user";
import { requireAuth } from "../middleware/auth";

export default {
  method: "GET",
  url: "/auth",
  preHandler: [requireAuth],
  handler: async function (req, res) {
    // this would be a good palce to add refreshTokens (swap to POST for that)
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.user.id));
    if (!user) {
      return res.status(401).send({ error: "Unauthorized" });
    }

    return res.send({ user: serializeUser(user, user) });
  },
} as RouteOptions<Server, IncomingMessage, ServerResponse>;
