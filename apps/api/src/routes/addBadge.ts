import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";
import type { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

import { BadgeInputSchema, BadgeSchema } from "@peated/shared/schemas";

import { db } from "../db";
import { badges } from "../db/schema";
import { serialize } from "../lib/serializers";
import { BadgeSerializer } from "../lib/serializers/badge";
import { requireAdmin } from "../middleware/auth";

export default {
  method: "POST",
  url: "/badges",
  schema: {
    body: zodToJsonSchema(BadgeInputSchema),
    response: {
      201: zodToJsonSchema(BadgeSchema),
    },
  },
  preHandler: [requireAdmin],
  handler: async (req, res) => {
    const body = req.body;

    // TODO: validate config based on type

    const badge = await db.transaction(async (tx) => {
      const [badge] = await tx.insert(badges).values(body).returning();

      return badge;
    });

    if (!badge) {
      return res.status(500).send({ error: "Failed to create badge" });
    }

    res.status(201).send(await serialize(BadgeSerializer, badge, req.user));
  },
} as RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Body: z.infer<typeof BadgeInputSchema>;
  }
>;
