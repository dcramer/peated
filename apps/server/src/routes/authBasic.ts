import { compareSync } from "bcrypt";
import { eq } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";
import zodToJsonSchema from "zod-to-json-schema";

import { AuthSchema } from "@peated/server/schemas";

import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import { createAccessToken } from "@peated/server/lib/auth";
import { serialize } from "@peated/server/serializers";
import { UserSerializer } from "@peated/server/serializers/user";

export default {
  method: "POST",
  url: "/auth/basic",
  schema: {
    body: {
      type: "object",
      required: ["email", "password"],
      properties: {
        email: { type: "string" },
        password: { type: "string" },
      },
    },
    response: {
      200: zodToJsonSchema(AuthSchema),
    },
  },
  handler: async function (req, res) {
    const { email, password } = req.body;

    const [user] = await db.select().from(users).where(eq(users.email, email));
    if (!user) {
      console.log("user not found");
      return res.status(401).send({ error: "Invalid credentials" });
    }

    if (!user.passwordHash) {
      console.log("user has no password set");
      return res.status(401).send({ error: "Invalid credentials" });
    }

    if (!compareSync(password, user.passwordHash)) {
      console.log("invalid password");
      return res.status(401).send({ error: "Invalid credentials" });
    }

    if (!user.active) {
      return res.status(401).send({ error: "Inactive account" });
    }

    return res.send({
      user: await serialize(UserSerializer, user, user),
      accessToken: await createAccessToken(user),
    });
  },
} as RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Body: {
      email: string;
      password: string;
    };
  }
>;
