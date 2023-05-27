import { eq } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import { UserInputSchema, UserSchema } from "@peated/shared/schemas";
import { db } from "../db";
import { users } from "../db/schema";
import { serialize } from "../lib/serializers";
import { UserSerializer } from "../lib/serializers/user";
import { requireAuth } from "../middleware/auth";

export default {
  method: "PUT",
  url: "/users/:userId",
  schema: {
    params: {
      type: "object",
      required: ["userId"],
      properties: {
        userId: { anyOf: [{ type: "number" }, { const: "me" }] },
      },
    },
    body: zodToJsonSchema(UserInputSchema.partial()),
    response: {
      200: zodToJsonSchema(UserSchema),
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

    const body = req.body;
    const data: { [name: string]: any } = {};
    if (
      body.displayName !== undefined &&
      body.displayName !== user.displayName
    ) {
      data.displayName = body.displayName;
    }

    if (body.username !== undefined && body.username !== user.username) {
      data.username = body.username.toLowerCase();
      if (data.username === "me") {
        return res.status(400).send({ error: "Invalid username" });
      }
    }

    if (body.private !== undefined && body.private !== user.private) {
      data.private = body.private;
    }

    if (body.admin !== undefined && body.admin !== user.admin) {
      if (!req.user.admin) {
        return res.status(403).send({ error: "Forbidden" });
      }
      data.admin = body.admin;
    }

    if (body.mod !== undefined && body.mod !== user.mod) {
      if (!req.user.admin) {
        return res.status(403).send({ error: "Forbidden" });
      }
      data.mod = body.mod;
    }

    if (!Object.values(data).length) {
      return res.send(await serialize(UserSerializer, user, req.user));
    }

    try {
      const [newUser] = await db
        .update(users)
        .set(data)
        .where(eq(users.id, userId))
        .returning();

      res.send(await serialize(UserSerializer, newUser, req.user));
    } catch (err: any) {
      if (err?.code === "23505" && err?.constraint === "user_username_unq") {
        return res.status(400).send({ error: "Username already in use" });
      } else {
        throw err;
      }
    }
  },
} as RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Params: {
      userId: number | "me";
    };
    Body: Partial<z.infer<typeof UserInputSchema>>;
  }
>;
