import { eq } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";
import zodToJsonSchema from "zod-to-json-schema";

import { AuthSchema } from "@peated/shared/schemas";

import { db } from "@peated/shared/db";
import { users } from "@peated/shared/db/schema";
import { serialize } from "../lib/serializers";
import { UserSerializer } from "../lib/serializers/user";
import { requireAuth } from "../middleware/auth";

export default {
  method: "GET",
  url: "/auth",
  preHandler: [requireAuth],
  schema: {
    response: {
      200: zodToJsonSchema(AuthSchema),
    },
  },
  handler: async function (req, res) {
    if (!req.user) return res.status(401).send({ error: "Unauthorized" });

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

    return res.send({ user: await serialize(UserSerializer, user, user) });
  },
} as RouteOptions<Server, IncomingMessage, ServerResponse>;
