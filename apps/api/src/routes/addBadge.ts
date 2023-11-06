import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";
import type { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

import { BadgeInputSchema, BadgeSchema } from "@peated/core/schemas";

import { db } from "@peated/core/db";
import { badges } from "@peated/core/db/schema";
import { logError } from "@peated/core/lib/log";
import { serialize } from "@peated/core/serializers";
import { BadgeSerializer } from "@peated/core/serializers/badge";
import { checkBadgeConfig } from "../lib/badges";
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
