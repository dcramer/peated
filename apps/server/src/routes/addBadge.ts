import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";
import type { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";
import { db } from "../db";
import { badges } from "../db/schema";
import { checkBadgeConfig } from "../lib/badges";
import { logError } from "../lib/log";
import { requireAdmin } from "../middleware/auth";
import { BadgeInputSchema, BadgeSchema } from "../schemas";
import { serialize } from "../serializers";
import { BadgeSerializer } from "../serializers/badge";

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
    if (!req.user) return res.status(401).send({ error: "Unauthorized" });

    const body = req.body;

    let config: Record<string, any>;
    try {
      config = await checkBadgeConfig(body.type, body.config);
    } catch (err) {
      logError(err);
      return res
        .status(400)
        .send({ error: "Failed to validate badge config " });
    }

    const badge = await db.transaction(async (tx) => {
      const [badge] = await tx
        .insert(badges)
        .values({ ...body, config })
        .returning();

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
