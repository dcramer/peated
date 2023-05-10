import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";

import { createAccessToken, serializeUser } from "../lib/auth";
import { compareSync } from "bcrypt";
import { db } from "../lib/db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";

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
  },
  handler: async function (req, res) {
    const { email, password } = req.body;

    const [user] = await db.select().from(users).where(eq(users.email, email));
    if (!user) {
      return res.status(401).send({ error: "Invalid credentials" });
    }

    if (!user.passwordHash) {
      return res.status(401).send({ error: "Invalid credentials" });
    }

    if (!compareSync(password, user.passwordHash)) {
      return res.status(401).send({ error: "Invalid credentials" });
    }

    return res.send({
      user: serializeUser(user, user),
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
